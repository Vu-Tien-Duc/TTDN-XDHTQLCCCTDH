const AttendanceLog = require('../models/attendanceLog.model');
const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const AuditLog = require('../models/auditLog.model');
const User = require('../models/user.model');
const { calculateAttendanceStatus, getAttendanceSummaryByUser } = require('../services/attendance.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Hàm tiện ích lấy ngày giờ hiện tại theo múi giờ Asia/Ho_Chi_Minh (UTC+7)
 */
const getVietnamTime = (date = new Date()) => {
  const vnTimeString = date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Date(vnTimeString);
};

/**
 * Chuyển đổi chuỗi "HH:mm" thành số phút tính từ đầu ngày (00:00)
 */
const timeStringToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * @desc Thực hiện Check-in tự động xác định ca và lịch làm việc
 * @route POST /api/attendance/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id; // Lấy từ token, không nhận từ client
    const { deviceId, location, method } = req.body;

    // 1. Quy đổi thời điểm hiện tại về Asia/Ho_Chi_Minh
    const nowVN = getVietnamTime();
    const currentWeekday = nowVN.getDay(); // 0 = Chủ nhật, 1-6 = Thứ 2 đến Thứ 7
    const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();

    const startOfTodayVN = new Date(nowVN);
    startOfTodayVN.setHours(0, 0, 0, 0);
    const endOfTodayVN = new Date(nowVN);
    endOfTodayVN.setHours(23, 59, 59, 999);

    // 2. Tìm trong schedules các lịch thỏa mãn:
    // - userId trùng
    // - weekday = hôm nay
    // - startDate <= hôm nay <= endDate
    const schedules = await Schedule.find({
      userId,
      weekday: currentWeekday,
      startDate: { $lte: endOfTodayVN },
      endDate: { $gte: startOfTodayVN },
    }).populate('shiftId');

    // 3. Lọc trong các lịch tìm được, CHỈ giữ lại lịch mà:
    // thời điểm hiện tại nằm trong khoảng [startTime - 30 phút, endTime]
    const matchingSchedules = schedules.filter((sch) => {
      if (!sch.shiftId || !sch.shiftId.startTime || !sch.shiftId.endTime) return false;
      const startMinutes = timeStringToMinutes(sch.shiftId.startTime);
      const endMinutes = timeStringToMinutes(sch.shiftId.endTime);
      return currentMinutes >= startMinutes - 30 && currentMinutes <= endMinutes;
    });

    // 4. Không có lịch nào thỏa khoảng trên -> trả lỗi ATTENDANCE_004
    if (matchingSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'ATTENDANCE_004',
        message: 'Không tìm thấy ca làm việc hoặc lịch công tác hiệu lực tại thời điểm này.',
      });
    }

    // 5 & 6. Xử lý trường hợp 1 lịch hoặc 2 lịch trùng khoảng
    let selectedSchedule = matchingSchedules[0];

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
        ipAddress: req.ip || req.connection.remoteAddress,
        timestamp: new Date(),
      });
    }

    const shift = selectedSchedule.shiftId;

    // Kiểm tra xem hôm nay đã check-in cho lịch này chưa
    const existingLog = await AttendanceLog.findOne({
      userId,
      scheduleId: selectedSchedule._id,
      checkInTime: { $gte: startOfTodayVN, $lte: endOfTodayVN },
    });

    if (existingLog) {
      return sendError(res, 'Bạn đã thực hiện check-in cho ca này hôm nay rồi.', existingLog, 400);
    }

    const checkInTime = new Date();
    const status = calculateAttendanceStatus(checkInTime, shift, nowVN);

    const validMethod = ['manual', 'face', 'qr', 'gps', 'fingerprint'].includes(method)
      ? method
      : 'manual';

    const log = await AttendanceLog.create({
      userId,
      shiftId: shift._id,
      scheduleId: selectedSchedule._id,
      checkInTime,
      method: validMethod,
      isManualOverride: false,
      status,
      location: location || { lat: null, lng: null },
      deviceId: deviceId || null,
    });

    const populatedLog = await AttendanceLog.findById(log._id)
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime')
      .populate('scheduleId', 'roomId weekday');

    return sendSuccess(res, 'Chấm công Check-in thành công.', populatedLog, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Thực hiện Check-out tự động tìm bản ghi đang mở của hôm nay
 * @route POST /api/attendance/check-out
 */
const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Giới hạn trong khoảng [00:00:00 - 23:59:59] của NGÀY HÔM NAY theo giờ Asia/Ho_Chi_Minh
    const nowVN = getVietnamTime();
    const startOfTodayVN = new Date(nowVN);
    startOfTodayVN.setHours(0, 0, 0, 0);
    const endOfTodayVN = new Date(nowVN);
    endOfTodayVN.setHours(23, 59, 59, 999);

    // Tự tìm bản ghi đang mở (chưa có checkOutTime) của chính userId
    const openLog = await AttendanceLog.findOne({
      userId,
      checkOutTime: null,
      checkInTime: { $gte: startOfTodayVN, $lte: endOfTodayVN },
    }).sort({ checkInTime: -1 });

    if (!openLog) {
      return sendError(res, 'Không tìm thấy bản ghi check-in nào còn mở trong ngày hôm nay.', null, 404);
    }

    openLog.checkOutTime = new Date();
    await openLog.save();

    const populated = await AttendanceLog.findById(openLog._id)
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime')
      .populate('scheduleId', 'roomId weekday');

    return sendSuccess(res, 'Chấm công Check-out thành công.', populated);
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

    // Phân quyền phạm vi truy cập:
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      query.userId = req.user.id; // Chỉ xem của chính mình
    } else if (req.user.role === 'truongkhoa') {
      // Xem của khoa mình
      const myInfo = await User.findById(req.user.id);
      const facultyUsers = await User.find({ departmentId: myInfo.departmentId }).select('_id');
      const facultyUserIds = facultyUsers.map((u) => u._id);

      if (userId) {
        if (!facultyUserIds.some((id) => id.toString() === userId)) {
          return sendError(res, 'Bạn không có quyền xem chấm công của nhân sự ngoài khoa.', null, 403);
        }
        query.userId = userId;
      } else {
        query.userId = { $in: facultyUserIds };
      }
    } else if (req.user.role === 'admin') {
      if (userId) query.userId = userId;
      else if (departmentId) {
        const deptUsers = await User.find({ departmentId }).select('_id');
        query.userId = { $in: deptUsers.map((u) => u._id) };
      }
    }

    if (status) query.status = status;
    if (from || to) {
      query.checkInTime = {};
      if (from) query.checkInTime.$gte = new Date(from);
      if (to) query.checkInTime.$lte = new Date(to);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await AttendanceLog.countDocuments(query);
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
      totalPages: Math.ceil(total / limitNum),
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
    const log = await AttendanceLog.findById(req.params.id)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .populate('scheduleId', 'roomId weekday startDate endDate')
      .populate('leaveRequestId', 'type reason status');

    if (!log) {
      return sendError(res, 'Không tìm thấy bản ghi chấm công.', null, 404);
    }

    // Kiểm tra quyền
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      if (log.userId._id.toString() !== req.user.id) {
        return sendError(res, 'Bạn không có quyền xem bản ghi này.', null, 403);
      }
    } else if (req.user.role === 'truongkhoa') {
      const myInfo = await User.findById(req.user.id);
      if (log.userId.departmentId && log.userId.departmentId.toString() !== myInfo.departmentId.toString()) {
        return sendError(res, 'Bạn không có quyền xem bản ghi nhân sự ngoài khoa.', null, 403);
      }
    }

    return sendSuccess(res, 'Lấy chi tiết chấm công thành công.', log);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Admin sửa bản ghi chấm công
 * @route PUT /api/attendance/:id
 */
const updateAttendanceByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, checkInTime, checkOutTime, leaveRequestId } = req.body;

    const log = await AttendanceLog.findById(id);
    if (!log) {
      return sendError(res, 'Không tìm thấy bản ghi chấm công.', null, 404);
    }

    const previousData = {
      status: log.status,
      checkInTime: log.checkInTime,
      checkOutTime: log.checkOutTime,
      method: log.method,
      isManualOverride: log.isManualOverride,
    };

    if (status !== undefined) log.status = status;
    if (checkInTime !== undefined) log.checkInTime = new Date(checkInTime);
    if (checkOutTime !== undefined) log.checkOutTime = new Date(checkOutTime);
    if (leaveRequestId !== undefined) log.leaveRequestId = leaveRequestId;

    // BẮT BUỘC set method = admin_override và isManualOverride = true
    log.method = 'admin_override';
    log.isManualOverride = true;

    await log.save();

    // Ghi audit log kèm giá trị cũ và mới
    await AuditLog.create({
      actor: req.user.id,
      action: 'EDIT_ATTENDANCE',
      targetId: log._id.toString(),
      targetType: 'AttendanceLog',
      ipAddress: req.ip || req.connection.remoteAddress,
      timestamp: new Date(),
    });

    return sendSuccess(res, 'Admin điều chỉnh bản ghi chấm công thành công.', {
      updatedLog: log,
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
