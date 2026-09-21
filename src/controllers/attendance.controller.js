const mongoose = require('mongoose');
const AttendanceLog = require('../models/attendanceLog.model');
const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const AuditLog = require('../models/auditLog.model');
const User = require('../models/user.model');
const {
  getVietnamTime,
  getVietnamDayRange,
  timeStringToMinutes,
  getTodayScheduleWindow,
  calculateAttendanceStatus,
  calculateCheckOutStatus,
  getAttendanceSummaryByUser,
  buildAttendanceDateFilter,
  euclideanDistance,
  FACE_MATCH_THRESHOLD,
  getCachedUsersWithFace,
  findBestFaceMatch,
  CAMPUS_CONFIG,
  getCampusConfig,
  updateCampusConfig,
  calculateDistanceMeters,
  validateGeofence,
  generateDynamicQRCode,
  verifyDynamicQRCode,
} = require('../services/attendance.service');
const { runDailyAbsentCheck } = require('../services/cron.service');
const {
  sendCheckInNotificationEmail,
  sendCheckOutNotificationEmail,
  sendAbsentWarningEmail,
} = require('../services/email.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ERROR_CODES = require('../utils/errorCodes');
const { getDeanScopedUserIds, isUserInDeanScope } = require('../utils/deanScope');

/**
 * @desc Thực hiện Check-in tự động xác định ca và lịch làm việc
 * @route POST /api/attendance/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id; // Lấy từ token, không nhận từ client
    const { deviceId, deviceInfo, location, latitude, longitude, method, shiftId, scheduleId } = req.body || {};
    const finalDeviceId = deviceId || deviceInfo || null;
    const finalLocation = location || (latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : { lat: null, lng: null });

    // 0. Geofencing Validation: Nếu phương thức là 'gps' hoặc client gửi tọa độ
    if (method === 'gps' || (finalLocation && finalLocation.lat !== null && finalLocation.lng !== null)) {
      const user = await User.findById(userId).populate('departmentId');
      const deptLocation = user?.departmentId?.location;
      const geofenceResult = validateGeofence(finalLocation, deptLocation);

      if (!geofenceResult.isInside) {
        return sendError(
          res,
          `Điểm danh GPS thất bại: Bạn đang cách ${geofenceResult.target.name} ${geofenceResult.distanceMeters}m (cho phép tối đa ${geofenceResult.allowedRadius}m). Vui lòng đến khuôn viên trường để điểm danh.`,
          {
            geofence: geofenceResult,
            clientLocation: finalLocation,
          },
          400,
          'ATTENDANCE_OUT_OF_GEOFENCE'
        );
      }
    }

    // 1. Quy đổi thời điểm hiện tại về Asia/Ho_Chi_Minh
    const nowVN = getVietnamTime();
    const currentWeekday = nowVN.getDay(); // 0 = Chủ nhật, 1-6 = Thứ 2 đến Thứ 7
    const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();

    const { startOfDay, endOfDay } = getVietnamDayRange();

    let shift = null;
    let selectedSchedule = null;

    // TRƯỜNG HỢP 1: Client truyền scheduleId trực tiếp (ưu tiên cao nhất, giải quyết trường hợp 1 giảng viên có nhiều lớp cùng ca trong ngày)
    if (scheduleId) {
      if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
        return sendError(res, 'Định dạng scheduleId không hợp lệ.', null, 400);
      }
      selectedSchedule = await Schedule.findOne({
        _id: scheduleId,
        userId,
        weekday: currentWeekday,
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay },
      }).populate('shiftId');

      if (!selectedSchedule) {
        return sendError(res, 'Không tìm thấy lịch giảng dạy tương ứng hoặc lịch không áp dụng hôm nay.', null, 404, ERROR_CODES.ATTENDANCE_NO_MATCHING_SCHEDULE);
      }

      shift = selectedSchedule.shiftId;
      if (!shift) {
        return sendError(res, 'Lịch giảng dạy chưa được cấu hình ca làm việc.', null, 400);
      }

      // Xác thực ca làm việc nếu client gửi kèm shiftId
      if (shiftId && mongoose.Types.ObjectId.isValid(shiftId)) {
        if (shift._id.toString() !== shiftId.toString()) {
          return sendError(res, 'Ca làm việc (shiftId) không khớp với lịch giảng dạy đã chọn.', null, 400);
        }
      }

      // Kiểm tra xem hôm nay đã check-in cho lịch này chưa
      const existingLog = await AttendanceLog.findOne({
        userId,
        scheduleId: selectedSchedule._id,
        checkInTime: { $gte: startOfDay, $lte: endOfDay },
      });

      if (existingLog) {
        return sendError(
          res,
          'Bạn đã thực hiện check-in cho lịch giảng dạy này hôm nay rồi.',
          existingLog,
          409,
          ERROR_CODES.ATTENDANCE_ALREADY_EXISTS
        );
      }
    } else if (shiftId) {
      // TRƯỜNG HỢP 2: Client truyền shiftId trực tiếp (Check-in thủ công theo ca)
      if (!mongoose.Types.ObjectId.isValid(shiftId)) {
        return sendError(res, 'Định dạng shiftId không hợp lệ.', null, 400);
      }
      shift = await ShiftConfig.findById(shiftId);
      if (!shift) {
        return sendError(res, 'Không tìm thấy ca làm việc.', null, 404, ERROR_CODES.SHIFT_NOT_FOUND);
      }

      // Kiểm tra xem hôm nay đã check-in cho ca này chưa
      const existingLog = await AttendanceLog.findOne({
        userId,
        shiftId: shift._id,
        checkInTime: { $gte: startOfDay, $lte: endOfDay },
      });

      if (existingLog) {
        return sendError(
          res,
          'Bạn đã thực hiện check-in cho ca này hôm nay rồi.',
          existingLog,
          409,
          ERROR_CODES.ATTENDANCE_ALREADY_EXISTS
        );
      }

      // Tìm lịch tương ứng hôm nay nếu có để liên kết
      selectedSchedule = await Schedule.findOne({
        userId,
        shiftId: shift._id,
        weekday: currentWeekday,
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay },
      });

      if (!selectedSchedule) {
        return sendError(
          res,
          'Bạn không có lịch được phân công cho ca này hôm nay.',
          null,
          400,
          ERROR_CODES.ATTENDANCE_NO_MATCHING_SCHEDULE
        );
      }
    } else {
      // TRƯỜNG HỢP 2: Tự động quét lịch dạy hôm nay của user trong khung ca
      const schedules = await Schedule.find({
        userId,
        weekday: currentWeekday,
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay },
      }).populate('shiftId');

      // Lọc trong các lịch tìm được, CHỈ giữ lại lịch mà:
      // thời điểm hiện tại nằm trong khoảng [startTime - 30 phút, endTime]
      const matchingSchedules = schedules.filter((sch) => {
        const window = getTodayScheduleWindow(sch.shiftId);
        if (!window) return false;
        return currentMinutes >= window.windowStartMinutes && currentMinutes <= window.windowEndMinutes;
      });

      // Không có lịch nào thỏa khoảng trên -> trả lỗi ATTENDANCE_004
      if (matchingSchedules.length === 0) {
        return sendError(
          res,
          'Không tìm thấy ca làm việc hoặc lịch công tác hiệu lực tại thời điểm này.',
          null,
          400,
          ERROR_CODES.ATTENDANCE_NO_MATCHING_SCHEDULE
        );
      }

      selectedSchedule = matchingSchedules[0];

      if (matchingSchedules.length > 1) {
        // Ưu tiên lịch có endTime gần thời điểm hiện tại nhất
        matchingSchedules.sort((a, b) => {
          const diffA = Math.abs(timeStringToMinutes(a.shiftId.endTime) - currentMinutes);
          const diffB = Math.abs(timeStringToMinutes(b.shiftId.endTime) - currentMinutes);
          return diffA - diffB;
        });
        selectedSchedule = matchingSchedules[0];

        // Ghi audit log cảnh báo lỗi trùng lịch
        await AuditLog.create({
          actor: userId,
          action: 'ATTENDANCE_OVERLAPPING_SCHEDULES_WARNING',
          targetId: selectedSchedule._id.toString(),
          targetType: 'Schedule',
          ipAddress: req.ip || req.connection?.remoteAddress,
          timestamp: new Date(),
        });
      }

      shift = selectedSchedule.shiftId;

      // Kiểm tra xem hôm nay đã check-in cho lịch này chưa (chống check-in trùng)
      const existingLog = await AttendanceLog.findOne({
        userId,
        scheduleId: selectedSchedule._id,
        checkInTime: { $gte: startOfDay, $lte: endOfDay },
      });

      if (existingLog) {
        return sendError(
          res,
          'Bạn đã thực hiện check-in cho ca này hôm nay rồi.',
          existingLog,
          409,
          ERROR_CODES.ATTENDANCE_ALREADY_EXISTS
        );
      }
    }

    const checkInTime = new Date();
    const status = calculateAttendanceStatus(checkInTime, shift, nowVN);
    const workDate = nowVN.toISOString().slice(0, 10);

    const validMethod = ['manual', 'face', 'qr', 'gps', 'fingerprint'].includes(method)
      ? method
      : 'manual';

    const log = await AttendanceLog.create({
      userId,
      shiftId: shift._id,
      scheduleId: selectedSchedule ? selectedSchedule._id : null,
      checkInTime,
      workDate,
      method: validMethod,
      isManualOverride: false,
      status,
      location: finalLocation,
      deviceId: finalDeviceId,
    });

    const populatedLog = await AttendanceLog.findById(log._id)
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday');

    // Gửi email thông báo Check-in (Đúng giờ hoặc Đi muộn)
    let lateMinutes = 0;
    if (status === 'LATE' && shift?.startTime) {
      const vnDate = getVietnamTime(checkInTime);
      const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
      const startMinutes = timeStringToMinutes(shift.startTime);
      lateMinutes = Math.max(0, currentMinutes - startMinutes);
    }
    if (populatedLog?.userId?.email) {
      sendCheckInNotificationEmail({
        to: populatedLog.userId.email,
        fullName: populatedLog.userId.fullName,
        shiftName: populatedLog.shiftId?.name,
        shiftHours: (shift?.startTime && shift?.endTime) ? `${shift.startTime} - ${shift.endTime}` : undefined,
        checkInTime,
        status,
        lateMinutes,
        method: validMethod,
        subjectName: populatedLog.scheduleId?.subjectName,
        roomId: populatedLog.scheduleId?.roomId,
      }).catch((err) => console.error('[EmailService] Check-in email error:', err.message));
    }

    return sendSuccess(res, 'Chấm công Check-in thành công.', populatedLog, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Thực hiện Check-out (hỗ trợ tự động tìm ca mở hoặc thủ công chỉ định shiftId/attendanceId)
 * @route POST /api/attendance/check-out
 */
const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { shiftId, attendanceId, deviceId, deviceInfo, location, latitude, longitude } = req.body || {};
    const finalDeviceId = deviceId || deviceInfo || null;
    const finalLocation = location || (latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : undefined);

    // Giới hạn trong khoảng [00:00:00 - 23:59:59] của NGÀY HÔM NAY theo múi giờ UTC+7
    const { startOfDay, endOfDay } = getVietnamDayRange();

    const query = {
      userId,
      checkOutTime: null,
      checkInTime: { $gte: startOfDay, $lte: endOfDay },
    };

    if (attendanceId && mongoose.Types.ObjectId.isValid(attendanceId)) {
      query._id = attendanceId;
    } else if (shiftId && mongoose.Types.ObjectId.isValid(shiftId)) {
      query.shiftId = shiftId;
    }

    // Tự tìm bản ghi đang mở (chưa có checkOutTime) của chính userId trong ngày hôm nay
    const openLog = await AttendanceLog.findOne(query)
      .populate('shiftId')
      .sort({ checkInTime: -1 });

    if (!openLog) {
      return sendError(
        res,
        'Không tìm thấy bản ghi check-in nào còn mở trong ngày hôm nay.',
        null,
        404,
        ERROR_CODES.ATTENDANCE_NO_OPEN_RECORD
      );
    }

    const checkOutTime = new Date();
    openLog.checkOutTime = checkOutTime;
    if (finalDeviceId) openLog.deviceId = finalDeviceId;
    if (finalLocation) openLog.location = finalLocation;

    // Đánh giá trạng thái về sớm (EARLY_LEAVE)
    const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      openLog.shiftId,
      openLog.status
    );
    openLog.status = finalStatus;

    await openLog.save();

    const populated = await AttendanceLog.findById(openLog._id)
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday');

    // Tính tổng thời lượng làm việc thực tế
    const durationMs = openLog.checkOutTime.getTime() - openLog.checkInTime.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / (60 * 1000)));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const formattedDuration = `${hours} giờ ${mins} phút`;

    // Gửi email thông báo Check-out (Hoàn thành hoặc Về sớm)
    if (populated?.userId?.email) {
      sendCheckOutNotificationEmail({
        to: populated.userId.email,
        fullName: populated.userId.fullName,
        shiftName: populated.shiftId?.name,
        checkInTime: openLog.checkInTime,
        checkOutTime,
        durationFormatted: formattedDuration,
        status: finalStatus,
        isEarlyLeave,
        earlyMinutes,
        method: populated.method || 'manual',
      }).catch((err) => console.error('[EmailService] Check-out email error:', err.message));
    }

    return sendSuccess(res, 'Chấm công Check-out thành công.', {
      ...populated.toObject(),
      workingDuration: {
        totalMinutes: durationMinutes,
        formatted: `${hours} giờ ${mins} phút`,
      },
      earlyLeave: {
        isEarlyLeave,
        earlyMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Lịch sử chấm công, phân trang, lọc theo tuần/tháng/status
 * @route GET /api/attendance/history
 */
const getAttendanceHistory = async (req, res, next) => {
  try {
    const { userId, departmentId, status, from, to, page = 1, limit = 20 } = req.query;
    const query = {};

    // 1. Phân quyền phạm vi truy cập (4 cấp quyền hạn):
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      // Giảng viên / Nhân viên: Hệ thống ép điều kiện chỉ xem lịch sử của chính mình
      query.userId = req.user.id;
    } else if (req.user.role === 'truongkhoa') {
      // Trưởng khoa: Tự động lọc danh sách nhân sự thuộc khoa và các bộ môn con trực thuộc
      const facultyUserIds = await getDeanScopedUserIds(req.user);
      if (!facultyUserIds.length) {
        return sendError(res, 'Tài khoản Trưởng khoa chưa được gán vào khoa/phòng ban nào hoặc khoa không có nhân sự.', null, 400);
      }

      if (userId) {
        if (!facultyUserIds.includes(userId.toString())) {
          return sendError(res, 'Bạn không có quyền xem chấm công của nhân sự ngoài khoa.', null, 403);
        }
        query.userId = userId;
      } else {
        query.userId = { $in: facultyUserIds };
      }
    } else if (req.user.role === 'admin') {
      // Admin: Xem toàn trường, lọc linh hoạt theo userId, departmentId
      if (userId) {
        query.userId = userId;
      } else if (departmentId) {
        const deptUsers = await User.find({ departmentId }).select('_id');
        query.userId = { $in: deptUsers.map((u) => u._id) };
      }
    }

    // 2. Bộ lọc theo trạng thái chấm công & phương thức
    if (status) query.status = status;
    if (req.query.method) query.method = req.query.method;

    // 3. Bộ lọc theo khoảng thời gian from - to
    if (from || to) {
      let toDate = to ? new Date(to) : null;
      if (toDate && typeof to === 'string' && to.length <= 10) {
        toDate.setHours(23, 59, 59, 999);
      }
      const dateFilter = buildAttendanceDateFilter(from, toDate);
      Object.assign(query, dateFilter);
    }

    // 4. Phân trang chuẩn (page, limit, skip, total, totalPages)
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const total = await AttendanceLog.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    const logs = await AttendanceLog.find(query)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime')
      .populate('scheduleId', 'roomId weekday')
      .populate('leaveRequestId', 'type reason')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limitNum);

    return sendSuccess(res, 'Lấy lịch sử chấm công thành công.', {
      total,
      page: pageNum,
      totalPages,
      records: logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Chi tiết một bản ghi chấm công
 * @route GET /api/attendance/:id
 */
const getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Định dạng ID bản ghi chấm công không hợp lệ.', null, 400);
    }

    const log = await AttendanceLog.findById(id)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday startDate endDate')
      .populate('leaveRequestId', 'type reason status');

    if (!log) {
      return sendError(res, 'Không tìm thấy bản ghi chấm công.', null, 404);
    }

    // Kiểm tra quyền xem chi tiết
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      if (log.userId._id.toString() !== req.user.id) {
        return sendError(res, 'Bạn không có quyền xem bản ghi chấm công của người khác.', null, 403);
      }
    } else if (req.user.role === 'truongkhoa') {
      const inScope = await isUserInDeanScope(req.user, log.userId._id || log.userId);
      if (!inScope) {
        return sendError(res, 'Bạn không có quyền xem bản ghi chấm công của nhân sự ngoài khoa.', null, 403);
      }
    }

    return sendSuccess(res, 'Lấy chi tiết chấm công thành công.', log);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Admin can thiệp điều chỉnh bản ghi chấm công (Manual Override) & Ghi vết Audit
 * @route PUT /api/attendance/:id
 */
const updateAttendanceByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Định dạng ID bản ghi chấm công không hợp lệ.', null, 400);
    }

    const { status, checkInTime, checkOutTime, leaveRequestId } = req.body;

    const log = await AttendanceLog.findById(id);
    if (!log) {
      return sendError(res, 'Không tìm thấy bản ghi chấm công.', null, 404);
    }

    // Lưu vết giá trị trước khi sửa
    const previousData = {
      status: log.status,
      checkInTime: log.checkInTime,
      checkOutTime: log.checkOutTime,
      method: log.method,
      isManualOverride: log.isManualOverride,
      leaveRequestId: log.leaveRequestId,
    };

    const nextCheckInTime = checkInTime !== undefined ? new Date(checkInTime) : log.checkInTime;
    const nextCheckOutTime = checkOutTime !== undefined ? new Date(checkOutTime) : log.checkOutTime;
    if (checkInTime !== undefined && Number.isNaN(nextCheckInTime.getTime())) {
      return sendError(res, 'Thời điểm check-in không hợp lệ.', null, 400);
    }
    if (checkOutTime !== undefined && Number.isNaN(nextCheckOutTime.getTime())) {
      return sendError(res, 'Thời điểm check-out không hợp lệ.', null, 400);
    }
    if (nextCheckInTime && nextCheckOutTime && nextCheckOutTime < nextCheckInTime) {
      return sendError(res, 'Thời điểm check-out không thể trước thời điểm check-in.', null, 400);
    }

    if (status !== undefined) log.status = status;
    if (checkInTime !== undefined) log.checkInTime = nextCheckInTime;
    if (checkOutTime !== undefined) log.checkOutTime = nextCheckOutTime;
    if (leaveRequestId !== undefined) log.leaveRequestId = leaveRequestId;

    // Bắt buộc gán cờ: isManualOverride = true và method = 'admin_override'
    log.method = 'admin_override';
    log.isManualOverride = true;

    await log.save();

    // Ghi ngay một bản ghi vào Collection audit_logs kèm giá trị trước và sau khi sửa
    await AuditLog.create({
      actor: req.user.id,
      action: 'EDIT_ATTENDANCE',
      targetId: log._id.toString(),
      targetType: 'AttendanceLog',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        before: previousData,
        after: {
          status: log.status,
          checkInTime: log.checkInTime,
          checkOutTime: log.checkOutTime,
          method: log.method,
          isManualOverride: log.isManualOverride,
          leaveRequestId: log.leaveRequestId,
        },
      },
    });

    const populatedLog = await AttendanceLog.findById(log._id)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday')
      .populate('leaveRequestId', 'type reason status');

    // Nếu Admin điều chỉnh trạng thái thành VẮNG MẶT (ABSENT) -> Gửi email cảnh báo
    if (log.status === 'ABSENT' && previousData.status !== 'ABSENT' && populatedLog?.userId?.email) {
      sendAbsentWarningEmail({
        to: populatedLog.userId.email,
        fullName: populatedLog.userId.fullName,
        shiftName: populatedLog.shiftId?.name,
        date: log.workDate || new Date().toISOString().slice(0, 10),
      }).catch((err) => console.error('[EmailService] Absent email warning error:', err.message));
    }

    return sendSuccess(res, 'Admin điều chỉnh bản ghi chấm công thành công.', {
      updatedLog: populatedLog,
      previousData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Kích hoạt thủ công tiến trình quét kiểm tra vắng mặt ngày hôm nay (Dành cho Admin kiểm thử Swagger / Postman)
 * POST /api/attendance/trigger-absent-cron
 * POST /api/attendance/cron/test-daily-check
 */
const triggerDailyAbsentCheck = async (req, res, next) => {
  try {
    const inputDate = req.body?.date || req.query?.date;
    let targetDate = new Date();
    if (inputDate) {
      targetDate = new Date(inputDate);
      if (isNaN(targetDate.getTime())) {
        return sendError(res, 'Định dạng ngày không hợp lệ. Vui lòng truyền YYYY-MM-DD.', null, 400);
      }
    }

    const summary = await runDailyAbsentCheck(targetDate);

    // Chuẩn hóa đúng cấu trúc nghiệp vụ Ngày 4
    const responseData = {
      scannedSchedules: summary.totalSchedules,
      alreadyAttended: summary.skippedCount,
      excusedAbsences: summary.excusedCreatedCount,
      newlyMarkedAbsent: summary.absentCreatedCount,
    };

    return sendSuccess(
      res,
      'Tiến trình quét vắng mặt hoàn tất.',
      responseData
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Helper xử lý điểm danh Face ID (Check-in / Check-out / Auto) cho 1 user đã match
 * @param {Object} params
 * @param {Object} params.bestMatch User matched
 * @param {number} params.bestDistance
 * @param {number} params.confidenceScore
 * @param {string} params.mode 'auto' | 'check_in' | 'check_out'
 * @param {string} [params.deviceId]
 * @returns {Promise<Object>} kết quả trả về
 */
const processFaceAttendanceUser = async ({
  bestMatch,
  bestDistance,
  confidenceScore,
  mode = 'auto',
  deviceId = 'KIOSK',
  reqIp = 'KIOSK',
  capturedImage = null,
  location = null,
}) => {
  const userId = bestMatch._id;
  const nowVN = getVietnamTime();
  const currentWeekday = nowVN.getDay();
  const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
  const { startOfDay, endOfDay } = getVietnamDayRange();

  // Helper thực hiện Check-out
  const executeCheckOut = async (openLog) => {
    const checkOutTime = new Date();
    openLog.checkOutTime = checkOutTime;
    if (capturedImage && !openLog.capturedImage) {
      openLog.capturedImage = capturedImage;
    }
    if (location && (!openLog.location || !openLog.location.lat)) {
      openLog.location = location;
    }
    const { finalStatus, isEarlyLeave, earlyMinutes } = calculateCheckOutStatus(
      checkOutTime,
      openLog.shiftId,
      openLog.status
    );
    openLog.status = finalStatus;
    await openLog.save();

    const populated = await AttendanceLog.findById(openLog._id)
      .populate('userId', 'fullName email avatar role')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday subjectName subjectCode');

    const durationMs = checkOutTime.getTime() - new Date(openLog.checkInTime).getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / (60 * 1000)));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const formattedDuration = `${hours} giờ ${mins} phút`;

    // Gửi email thông báo Face Check-out (Hoàn thành ca / Về sớm)
    const targetEmail = populated?.userId?.email || bestMatch?.email;
    if (targetEmail) {
      sendCheckOutNotificationEmail({
        to: targetEmail,
        fullName: populated?.userId?.fullName || bestMatch?.fullName,
        shiftName: populated?.shiftId?.name,
        checkInTime: openLog.checkInTime,
        checkOutTime,
        durationFormatted: formattedDuration,
        status: finalStatus,
        isEarlyLeave,
        earlyMinutes,
        method: 'face',
      }).catch((err) => console.error('[EmailService] Face check-out email error:', err.message));
    }

    // Ghi AuditLog cho Face Check-out (P4 - Item 25)
    AuditLog.create({
      actor: userId,
      action: 'FACE_CHECK_OUT',
      targetId: openLog._id.toString(),
      targetType: 'AttendanceLog',
      ipAddress: reqIp,
      timestamp: checkOutTime,
      details: {
        method: 'face',
        deviceId,
        confidenceScore,
        distance: bestDistance,
        workingMinutes: durationMinutes,
        status: finalStatus,
        location,
      },
    }).catch((err) => console.error('[AuditLog Error] Lỗi ghi audit log Face Check-out:', err.message));

    return {
      status: 'OK',
      action: 'CHECK_OUT',
      message: `Check-out (Ra về) thành công: ${bestMatch.fullName}`,
      attendance: populated,
      user: {
        _id: bestMatch._id,
        fullName: bestMatch.fullName,
        email: bestMatch.email,
        avatar: bestMatch.avatar,
        role: bestMatch.role,
      },
      statusText: finalStatus,
      workingDuration: {
        totalMinutes: durationMinutes,
        formatted: `${hours} giờ ${mins} phút`,
      },
      earlyLeave: { isEarlyLeave, earlyMinutes },
      confidenceScore,
      distance: +bestDistance.toFixed(4),
      checkOutTime,
    };
  };

  // Helper thực hiện Check-in
  const executeCheckIn = async (selectedSchedule) => {
    const shift = selectedSchedule.shiftId;
    const checkInTime = new Date();
    const status = calculateAttendanceStatus(checkInTime, shift, nowVN);
    const workDate = nowVN.toISOString().slice(0, 10);

    let log;
    try {
      log = await AttendanceLog.create({
        userId,
        shiftId: shift._id,
        scheduleId: selectedSchedule._id,
        checkInTime,
        workDate,
        method: 'face',
        isManualOverride: false,
        status,
        confidenceScore,
        capturedImage: capturedImage || null,
        location: location || { lat: null, lng: null },
        deviceId,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return {
          status: 'ALREADY_CHECKED_IN',
          message: `${bestMatch.fullName} đã check-in cho ca này hôm nay rồi.`,
          userId,
          fullName: bestMatch.fullName,
          confidenceScore,
          distance: +bestDistance.toFixed(4),
        };
      }
      throw createErr;
    }

    const populatedLog = await AttendanceLog.findById(log._id)
      .populate('userId', 'fullName email avatar role')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday subjectName subjectCode');

    // Gửi email thông báo Face Check-in (Đúng giờ hoặc Đi muộn)
    let lateMinutes = 0;
    if (status === 'LATE' && shift?.startTime) {
      const vnDate = getVietnamTime(checkInTime);
      const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
      const startMinutes = timeStringToMinutes(shift.startTime);
      lateMinutes = Math.max(0, currentMinutes - startMinutes);
    }
    const targetEmail = populatedLog?.userId?.email || bestMatch?.email;
    if (targetEmail) {
      sendCheckInNotificationEmail({
        to: targetEmail,
        fullName: populatedLog?.userId?.fullName || bestMatch?.fullName,
        shiftName: populatedLog?.shiftId?.name,
        shiftHours: (shift?.startTime && shift?.endTime) ? `${shift.startTime} - ${shift.endTime}` : undefined,
        checkInTime,
        status,
        lateMinutes,
        method: 'face',
        subjectName: populatedLog?.scheduleId?.subjectName,
        roomId: populatedLog?.scheduleId?.roomId,
      }).catch((err) => console.error('[EmailService] Face check-in email error:', err.message));
    }

    // Ghi AuditLog cho Face Check-in (P4 - Item 25)
    AuditLog.create({
      actor: userId,
      action: 'FACE_CHECK_IN',
      targetId: log._id.toString(),
      targetType: 'AttendanceLog',
      ipAddress: reqIp,
      timestamp: checkInTime,
      details: {
        method: 'face',
        deviceId,
        confidenceScore,
        distance: bestDistance,
        status,
        location,
      },
    }).catch((err) => console.error('[AuditLog Error] Lỗi ghi audit log Face Check-in:', err.message));

    return {
      status: 'OK',
      action: 'CHECK_IN',
      message: `Check-in (Vào ca) thành công: ${bestMatch.fullName}`,
      attendance: populatedLog,
      user: {
        _id: bestMatch._id,
        fullName: bestMatch.fullName,
        email: bestMatch.email,
        avatar: bestMatch.avatar,
        role: bestMatch.role,
      },
      statusText: status,
      confidenceScore,
      distance: +bestDistance.toFixed(4),
      checkInTime,
    };
  };

  // 1. Chế độ RA VỀ (CHECK_OUT)
  if (mode === 'check_out') {
    const openLog = await AttendanceLog.findOne({
      userId,
      checkOutTime: null,
      checkInTime: { $gte: startOfDay, $lte: endOfDay },
    }).populate('shiftId');

    if (!openLog) {
      return {
        status: 'NO_OPEN_CHECKIN',
        message: `${bestMatch.fullName} chưa có lượt Check-in nào hôm nay để Check-out.`,
        userId,
        fullName: bestMatch.fullName,
        confidenceScore,
        distance: +bestDistance.toFixed(4),
      };
    }

    return await executeCheckOut(openLog);
  }

  // 2. Chế độ VÀO CA (CHECK_IN)
  if (mode === 'check_in') {
    const schedules = await Schedule.find({
      userId,
      weekday: currentWeekday,
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    }).populate('shiftId');

    const matchingSchedules = schedules.filter((sch) => {
      const window = getTodayScheduleWindow(sch.shiftId);
      if (!window) return false;
      return currentMinutes >= window.windowStartMinutes && currentMinutes <= window.windowEndMinutes;
    });

    if (matchingSchedules.length === 0) {
      return {
        status: 'NO_SCHEDULE',
        message: `${bestMatch.fullName}: Không tìm thấy ca làm việc tại thời điểm này.`,
        userId,
        fullName: bestMatch.fullName,
        confidenceScore,
        distance: +bestDistance.toFixed(4),
      };
    }

    const selectedSchedule = matchingSchedules[0];

    const existingLog = await AttendanceLog.findOne({
      userId,
      scheduleId: selectedSchedule._id,
      checkInTime: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingLog) {
      return {
        status: 'ALREADY_CHECKED_IN',
        message: `${bestMatch.fullName} đã check-in cho ca này hôm nay rồi.`,
        userId,
        fullName: bestMatch.fullName,
        existingLog,
        confidenceScore,
        distance: +bestDistance.toFixed(4),
      };
    }

    return await executeCheckIn(selectedSchedule);
  }

  // 3. Chế độ TỰ ĐỘNG THÔNG MINH (AUTO)
  // Ưu tiên: nếu đang có ca check-in mở hôm nay -> tự động chuyển sang Check-out
  const openLog = await AttendanceLog.findOne({
    userId,
    checkOutTime: null,
    checkInTime: { $gte: startOfDay, $lte: endOfDay },
  }).populate('shiftId');

  if (openLog) {
    // Tránh double tap: nếu mới check-in chưa quá 60 giây, nhắc nhở không quét liên tục
    const diffSeconds = (Date.now() - new Date(openLog.checkInTime).getTime()) / 1000;
    if (diffSeconds < 60) {
      return {
        status: 'RECENTLY_CHECKED_IN',
        message: `${bestMatch.fullName} vừa Check-in xong (${Math.round(diffSeconds)}s trước). Vui lòng không quét liên tiếp.`,
        userId,
        fullName: bestMatch.fullName,
        confidenceScore,
        distance: +bestDistance.toFixed(4),
      };
    }

    // Chống Check-out nhầm giữa ca (P1 - Item 6, Item 8)
    const endMinutes = timeStringToMinutes(openLog.shiftId?.endTime || '23:59');
    const nearEnd = currentMinutes >= endMinutes - 45;

    // Ở chế độ auto: Chỉ tự động check-out nếu sắp hết ca hoặc đã hết ca (trong vòng 45 phút trước khi kết thúc ca, hoặc sau khi ca kết thúc).
    // Nếu vẫn đang giữa ca và chưa đến giờ tan ca, KHÔNG tự ý check-out ở chế độ auto! Nhắc người dùng: nếu muốn về sớm thì chuyển sang tab "Ra về".
    if (!nearEnd) {
      return {
        status: 'MID_SHIFT_SCAN',
        message: `${bestMatch.fullName} đang trong ca giảng dạy (${openLog.shiftId?.name || ''}). Nếu bạn thực sự muốn về sớm, vui lòng chọn chế độ "Ra về (Check-out)".`,
        userId,
        fullName: bestMatch.fullName,
        confidenceScore,
        distance: +bestDistance.toFixed(4),
      };
    }

    // Tự động Check-out khi quét lại lúc tan ca
    return await executeCheckOut(openLog);
  }

  // Nếu không có ca mở: Tìm ca hôm nay để Check-in
  const schedules = await Schedule.find({
    userId,
    weekday: currentWeekday,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  }).populate('shiftId');

  const matchingSchedules = schedules.filter((sch) => {
    const window = getTodayScheduleWindow(sch.shiftId);
    if (!window) return false;
    return currentMinutes >= window.windowStartMinutes && currentMinutes <= window.windowEndMinutes;
  });

  if (matchingSchedules.length === 0) {
    return {
      status: 'NO_SCHEDULE',
      message: `Nhận diện: ${bestMatch.fullName}. Không tìm thấy ca làm việc tại thời điểm này.`,
      userId,
      fullName: bestMatch.fullName,
      confidenceScore,
      distance: +bestDistance.toFixed(4),
    };
  }

  const selectedSchedule = matchingSchedules[0];

  // Kiểm tra nếu đã hoàn thành cả check-in và check-out ca này
  const completedLog = await AttendanceLog.findOne({
    userId,
    scheduleId: selectedSchedule._id,
    checkInTime: { $gte: startOfDay, $lte: endOfDay },
    checkOutTime: { $ne: null },
  });

  if (completedLog) {
    return {
      status: 'ALREADY_COMPLETED',
      message: `${bestMatch.fullName} đã hoàn thành cả Check-in và Check-out ca này hôm nay.`,
      userId,
      fullName: bestMatch.fullName,
      confidenceScore,
      distance: +bestDistance.toFixed(4),
    };
  }

  return await executeCheckIn(selectedSchedule);
};

/**
 * @desc Điểm danh bằng khuôn mặt qua Kiosk (hỗ trợ auto, check_in, check_out)
 * @route POST /api/attendance/face-checkin
 */
const faceCheckIn = async (req, res, next) => {
  try {
    const { faceDescriptor, mode = 'auto', capturedImage, image, location, latitude, longitude } = req.body;
    const finalLocation = location || (latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : null);

    // 1. Validate faceDescriptor
    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return sendError(res, 'faceDescriptor phải là mảng 128 số thực.', null, 400);
    }

    // 2. Bảo mật 2 lớp (2FA): Nếu thiết bị có gửi kèm tọa độ GPS, kiểm tra xem có nằm trong khuôn viên trường không
    if (finalLocation && finalLocation.lat !== null && finalLocation.lng !== null) {
      const geofenceResult = validateGeofence(finalLocation);
      if (!geofenceResult.isInside) {
        return sendError(
          res,
          `Bảo mật 2FA thất bại: Nhận diện khuôn mặt hợp lệ nhưng thiết bị nằm ngoài khuôn viên trường (${geofenceResult.distanceMeters}m > ${geofenceResult.allowedRadius}m).`,
          { geofence: geofenceResult },
          400,
          'FACE_2FA_OUT_OF_GEOFENCE'
        );
      }
    }

    // 3. Lấy danh sách users từ RAM Cache (P4 - Item 22)
    const usersWithFace = await getCachedUsersWithFace();
    if (usersWithFace.length === 0) {
      return sendError(res, 'Chưa có giảng viên/nhân viên nào đăng ký Face ID.', null, 404);
    }

    // 4. So khớp vector (hỗ trợ cả đơn và đa vector) theo ngưỡng chuẩn FACE_MATCH_THRESHOLD (P1 - Item 11, P2 - Item 12)
    const { bestMatch, bestDistance, confidenceScore } = findBestFaceMatch(faceDescriptor, usersWithFace, FACE_MATCH_THRESHOLD);

    if (!bestMatch) {
      return sendError(
        res,
        'Không nhận diện được khuôn mặt. Khoảng cách quá lớn hoặc chưa đăng ký Face ID.',
        { distance: bestDistance ? +bestDistance.toFixed(4) : null },
        404
      );
    }

    const result = await processFaceAttendanceUser({
      bestMatch,
      bestDistance,
      confidenceScore,
      mode,
      deviceId: req.headers['x-device-id'] || 'KIOSK',
      reqIp: req.ip || req.connection?.remoteAddress || 'KIOSK',
      capturedImage: capturedImage || image || null,
      location: finalLocation,
    });

    if (result.status !== 'OK') {
      const statusCode = result.status === 'ALREADY_CHECKED_IN' || result.status === 'ALREADY_COMPLETED' ? 409 : 400;
      return sendError(res, result.message, result, statusCode);
    }

    return sendSuccess(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Batch Face Check-in / Check-out cho nhiều khuôn mặt đồng thời
 * @route POST /api/attendance/face-checkin-batch
 */
const faceCheckInBatch = async (req, res, next) => {
  try {
    const { faceDescriptors, mode = 'auto' } = req.body;
    if (!Array.isArray(faceDescriptors) || faceDescriptors.length === 0) {
      return sendError(res, 'faceDescriptors phải là mảng các vector 128 số thực.', null, 400);
    }

    // Validate each descriptor length
    for (const fd of faceDescriptors) {
      if (!Array.isArray(fd) || fd.length !== 128) {
        return sendError(res, 'Mỗi faceDescriptor phải là mảng 128 số thực.', null, 400);
      }
    }

    // Load users từ RAM Cache
    const usersWithFace = await getCachedUsersWithFace();
    if (usersWithFace.length === 0) {
      return sendError(res, 'Chưa có giảng viên/nhân viên nào đăng ký Face ID.', null, 404);
    }

    const results = [];
    const processedUserIds = new Set(); // P1 - Item 10: Khử trùng lặp cùng 1 người trong 1 frame

    for (let i = 0; i < faceDescriptors.length; i++) {
      const descriptor = faceDescriptors[i];
      const { bestMatch, bestDistance, confidenceScore } = findBestFaceMatch(descriptor, usersWithFace, FACE_MATCH_THRESHOLD);

      if (!bestMatch) {
        results.push({ descriptorIndex: i, status: 'NO_MATCH', distance: +bestDistance.toFixed(4) });
        continue;
      }

      if (processedUserIds.has(bestMatch._id.toString())) {
        results.push({
          descriptorIndex: i,
          userId: bestMatch._id,
          fullName: bestMatch.fullName,
          status: 'DUPLICATE_IN_BATCH',
          message: `${bestMatch.fullName} đã được nhận diện trong cùng khung hình này.`,
          distance: +bestDistance.toFixed(4),
        });
        continue;
      }
      processedUserIds.add(bestMatch._id.toString());

      const itemResult = await processFaceAttendanceUser({
        bestMatch,
        bestDistance,
        confidenceScore,
        mode,
        deviceId: req.headers['x-device-id'] || 'KIOSK',
        reqIp: req.ip || req.connection?.remoteAddress || 'KIOSK',
      });

      results.push({ descriptorIndex: i, ...itemResult });
    }

    return sendSuccess(res, 'Batch face attendance processed', results, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Sinh mã QR Động phục vụ điểm danh trên màn hình Kiosk / Giảng đường (Đổi mã mỗi 20s)
 * @route GET /api/attendance/qr/generate
 */
const generateQRCode = async (req, res, next) => {
  try {
    const { roomId, subjectCode } = req.query;
    const qrData = generateDynamicQRCode({
      roomId: roomId || 'KIOSK_MAIN',
      subjectCode: subjectCode || null,
      generatedBy: req.user?.id || 'SYSTEM',
    });

    return sendSuccess(res, 'Mã QR động đã được tạo thành công (hiệu lực 20 giây)', qrData, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Quét mã QR Động bằng điện thoại để điểm danh
 * @route POST /api/attendance/qr/scan
 */
const scanQRCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { qrToken, location, latitude, longitude, deviceId } = req.body;

    if (!qrToken) {
      return sendError(res, 'Mã qrToken là bắt buộc.', null, 400);
    }

    // 1. Xác thực tính hợp lệ và thời gian sống của token QR
    const verifyResult = verifyDynamicQRCode(qrToken);
    if (!verifyResult.valid) {
      return sendError(res, verifyResult.message || 'Mã QR không hợp lệ hoặc đã hết hạn.', null, 400);
    }

    const finalDeviceId = deviceId || 'MOBILE_APP';
    const finalLocation = location || (latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : { lat: null, lng: null });

    // 2. Nếu có gửi kèm GPS, kiểm tra hàng rào địa lý
    if (finalLocation.lat !== null && finalLocation.lng !== null) {
      const user = await User.findById(userId).populate('departmentId');
      const deptLocation = user?.departmentId?.location;
      const geofenceResult = validateGeofence(finalLocation, deptLocation);

      if (!geofenceResult.isInside) {
        return sendError(
          res,
          `Điểm danh QR thất bại: Bạn đang cách ${geofenceResult.target.name} ${geofenceResult.distanceMeters}m (cho phép tối đa ${geofenceResult.allowedRadius}m).`,
          { geofence: geofenceResult },
          400,
          'ATTENDANCE_OUT_OF_GEOFENCE'
        );
      }
    }

    // 3. Tự động xác định ca và lịch dạy hôm nay để check-in
    const nowVN = getVietnamTime();
    const currentWeekday = nowVN.getDay();
    const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
    const { startOfDay, endOfDay } = getVietnamDayRange();

    const schedules = await Schedule.find({
      userId,
      weekday: currentWeekday,
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    }).populate('shiftId');

    const matchingSchedules = schedules.filter((sch) => {
      const window = getTodayScheduleWindow(sch.shiftId);
      if (!window) return false;
      return currentMinutes >= window.windowStartMinutes && currentMinutes <= window.windowEndMinutes;
    });

    if (matchingSchedules.length === 0) {
      return sendError(res, 'Không tìm thấy ca làm việc hoặc lịch công tác hiệu lực tại thời điểm này.', null, 400, ERROR_CODES.ATTENDANCE_NO_MATCHING_SCHEDULE);
    }

    const selectedSchedule = matchingSchedules[0];
    const shift = selectedSchedule.shiftId;

    // Kiểm tra xem đã check-in chưa
    const existingLog = await AttendanceLog.findOne({
      userId,
      scheduleId: selectedSchedule._id,
      checkInTime: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingLog) {
      return sendError(res, 'Bạn đã thực hiện check-in cho ca này hôm nay rồi.', existingLog, 409, ERROR_CODES.ATTENDANCE_ALREADY_EXISTS);
    }

    const checkInTime = new Date();
    const status = calculateAttendanceStatus(checkInTime, shift, nowVN);
    const workDate = nowVN.toISOString().slice(0, 10);

    const log = await AttendanceLog.create({
      userId,
      shiftId: shift._id,
      scheduleId: selectedSchedule._id,
      checkInTime,
      workDate,
      method: 'qr',
      isManualOverride: false,
      status,
      location: finalLocation,
      deviceId: finalDeviceId,
    });

    const populatedLog = await AttendanceLog.findById(log._id)
      .populate('userId', 'fullName email avatar role')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday subjectName subjectCode');

    // Gửi email thông báo QR Check-in (Đúng giờ hoặc Đi muộn)
    let lateMinutes = 0;
    if (status === 'LATE' && shift?.startTime) {
      const vnDate = getVietnamTime(checkInTime);
      const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
      const startMinutes = timeStringToMinutes(shift.startTime);
      lateMinutes = Math.max(0, currentMinutes - startMinutes);
    }
    if (populatedLog?.userId?.email) {
      sendCheckInNotificationEmail({
        to: populatedLog.userId.email,
        fullName: populatedLog.userId.fullName,
        shiftName: populatedLog.shiftId?.name,
        shiftHours: (shift?.startTime && shift?.endTime) ? `${shift.startTime} - ${shift.endTime}` : undefined,
        checkInTime,
        status,
        lateMinutes,
        method: 'qr',
        subjectName: populatedLog.scheduleId?.subjectName,
        roomId: populatedLog.scheduleId?.roomId,
      }).catch((err) => console.error('[EmailService] QR check-in email error:', err.message));
    }

    AuditLog.create({
      actor: userId,
      action: 'QR_CHECK_IN',
      targetId: log._id.toString(),
      targetType: 'AttendanceLog',
      ipAddress: req.ip || req.connection?.remoteAddress,
      timestamp: checkInTime,
      details: {
        method: 'qr',
        status,
        deviceId: finalDeviceId,
        location: finalLocation,
      },
    }).catch((err) => console.error('[AuditLog Error] Lỗi ghi audit log QR Check-in:', err.message));

    return sendSuccess(res, '🎉 Điểm danh bằng Mã QR Động thành công!', populatedLog, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Lấy thông số cấu hình vị trí thực tế của trường (Geofence)
 * @route GET /api/attendance/campus-config
 */
const getCampusLocationConfig = async (req, res, next) => {
  try {
    const config = getCampusConfig();
    return sendSuccess(res, 'Lấy cấu hình vị trí khuôn viên trường thành công.', config, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cập nhật vị trí khuôn viên trường theo tọa độ thực tế
 * @route POST /api/attendance/campus-config
 */
const updateCampusLocationConfig = async (req, res, next) => {
  try {
    const { name, lat, lng, radiusMeters } = req.body;
    const updated = updateCampusConfig({ name, lat, lng, radiusMeters });
    return sendSuccess(res, 'Cập nhật tọa độ vị trí trường học thành công.', updated, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getAttendanceById,
  updateAttendanceByAdmin,
  triggerDailyAbsentCheck,
  faceCheckIn,
  faceCheckInBatch,
  generateQRCode,
  scanQRCode,
  getCampusLocationConfig,
  updateCampusLocationConfig,
};


