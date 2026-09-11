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
} = require('../services/attendance.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * @desc Thực hiện Check-in tự động xác định ca và lịch làm việc
 * @route POST /api/attendance/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id; // Lấy từ token, không nhận từ client
    const { deviceId, location, method, shiftId } = req.body;

    // 1. Quy đổi thời điểm hiện tại về Asia/Ho_Chi_Minh
    const nowVN = getVietnamTime();
    const currentWeekday = nowVN.getDay(); // 0 = Chủ nhật, 1-6 = Thứ 2 đến Thứ 7
    const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();

    const { startOfDay, endOfDay } = getVietnamDayRange();

    let shift = null;
    let selectedSchedule = null;

    // TRƯỜNG HỢP 1: Client truyền shiftId trực tiếp (Check-in thủ công theo ca)
    if (shiftId) {
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

    const validMethod = ['manual', 'face', 'qr', 'gps', 'fingerprint'].includes(method)
      ? method
      : 'manual';

    const log = await AttendanceLog.create({
      userId,
      shiftId: shift._id,
      scheduleId: selectedSchedule ? selectedSchedule._id : null,
      checkInTime,
      method: validMethod,
      isManualOverride: false,
      status,
      location: location || { lat: null, lng: null },
      deviceId: deviceId || null,
    });

    const populatedLog = await AttendanceLog.findById(log._id)
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday');

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
    const { shiftId, attendanceId } = req.body || {};

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
      // Trưởng khoa: Tự động lọc danh sách nhân sự thuộc khoa của mình (departmentId), không được xem ngoài khoa
      const myDeptId = req.user.departmentId || (await User.findById(req.user.id))?.departmentId?.toString();
      if (!myDeptId) {
        return sendError(res, 'Tài khoản Trưởng khoa chưa được gán vào khoa/phòng ban nào.', null, 400);
      }
      const facultyUsers = await User.find({ departmentId: myDeptId }).select('_id');
      const facultyUserIds = facultyUsers.map((u) => u._id.toString());

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

    // 2. Bộ lọc theo trạng thái chấm công
    if (status) query.status = status;

    // 3. Bộ lọc theo khoảng thời gian from - to
    if (from || to) {
      query.checkInTime = {};
      if (from) query.checkInTime.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        if (typeof to === 'string' && to.length <= 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        query.checkInTime.$lte = toDate;
      }
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
      const myDeptId = req.user.departmentId || (await User.findById(req.user.id))?.departmentId?.toString();
      const logUserDept = log.userId?.departmentId ? log.userId.departmentId.toString() : null;
      if (!logUserDept || logUserDept !== myDeptId) {
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

    if (status !== undefined) log.status = status;
    if (checkInTime !== undefined) log.checkInTime = new Date(checkInTime);
    if (checkOutTime !== undefined) log.checkOutTime = new Date(checkOutTime);
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

    return sendSuccess(res, 'Admin điều chỉnh bản ghi chấm công thành công.', {
      updatedLog: populatedLog,
      previousData,
    });
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
};
