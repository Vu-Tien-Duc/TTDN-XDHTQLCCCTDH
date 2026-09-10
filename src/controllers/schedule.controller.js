const Schedule = require('../models/schedule.model');
const ShiftConfig = require('../models/shiftConfig.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * Chuyển đổi chuỗi giờ 'HH:mm' thành tổng số phút trong ngày để so sánh
 */
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Lấy danh sách lịch phân công giảng dạy/công tác
 * GET /api/schedules
 */
const getSchedules = async (req, res, next) => {
  try {
    const { userId, shiftId, weekday, startDate, endDate, date, page, limit } = req.query;
    const query = {};

    // 1. Phân quyền: Giảng viên / Nhân viên chỉ xem lịch của chính mình
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      query.userId = req.user.id;
    } else if (userId) {
      // Admin hoặc Trưởng khoa có thể xem toàn trường hoặc lọc theo người
      query.userId = userId;
    }

    if (shiftId) query.shiftId = shiftId;
    if (weekday !== undefined && weekday !== '') query.weekday = Number(weekday);

    // 2. Lọc theo khung học kỳ hoặc ngày cụ thể
    if (startDate && endDate) {
      query.startDate = { $lte: new Date(endDate) };
      query.endDate = { $gte: new Date(startDate) };
    } else if (date) {
      const targetDate = new Date(date);
      query.startDate = { $lte: targetDate };
      query.endDate = { $gte: targetDate };
    }

    // 3. Hỗ trợ phân trang (page, limit)
    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, parseInt(limit, 10));
      const skip = (pageNum - 1) * limitNum;

      const [total, schedules] = await Promise.all([
        Schedule.countDocuments(query),
        Schedule.find(query)
          .populate('userId', 'fullName email role departmentId')
          .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
          .sort({ weekday: 1, startTime: 1, startDate: 1 })
          .skip(skip)
          .limit(limitNum),
      ]);

      return sendSuccess(res, 'Lấy danh sách lịch phân công thành công.', {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
        schedules,
      });
    }

    // Trả về toàn bộ danh sách phù hợp nếu không truyền phân trang
    const schedules = await Schedule.find(query)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .sort({ weekday: 1, startTime: 1, startDate: 1 });

    return sendSuccess(res, 'Lấy danh sách lịch phân công thành công.', schedules);
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy chi tiết một lịch cụ thể theo ID
 * GET /api/schedules/:id
 */
const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes');

    if (!schedule) {
      return sendError(
        res,
        'Không tìm thấy lịch giảng dạy/công tác.',
        null,
        404,
        ERROR_CODES.SCHEDULE_NOT_FOUND
      );
    }

    // Phân quyền: Giảng viên/Nhân viên không được xem chi tiết lịch của người khác
    if (
      (req.user.role === 'giangvien' || req.user.role === 'nhanvien') &&
      schedule.userId &&
      schedule.userId._id.toString() !== req.user.id
    ) {
      return sendError(
        res,
        'Bạn không có quyền xem chi tiết lịch của người khác.',
        null,
        403,
        ERROR_CODES.AUTH_FORBIDDEN
      );
    }

    return sendSuccess(res, 'Lấy chi tiết lịch thành công.', schedule);
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo mới lịch phân công (Chỉ Admin hoặc Trưởng khoa)
 * Áp dụng thuật toán kiểm tra xung đột thời gian (Conflict Detection)
 * POST /api/schedules
 */
const createSchedule = async (req, res, next) => {
  try {
    const {
      userId,
      shiftId,
      startTime,
      endTime,
      roomId,
      weekday,
      isRecurring,
      startDate,
      endDate,
    } = req.body;

    // 1. Kiểm tra các trường bắt buộc
    if (!userId || !shiftId || weekday === undefined || !startDate || !endDate) {
      return sendError(
        res,
        'Vui lòng cung cấp đầy đủ: userId, shiftId, weekday, startDate, endDate.',
        null,
        400,
        ERROR_CODES.SCHEDULE_INVALID_DATA
      );
    }

    const weekdayNum = Number(weekday);
    if (isNaN(weekdayNum) || weekdayNum < 0 || weekdayNum > 6) {
      return sendError(
        res,
        'Thứ trong tuần (weekday) phải là số từ 0 (Chủ nhật) đến 6 (Thứ bảy).',
        null,
        400,
        ERROR_CODES.SCHEDULE_INVALID_DATA
      );
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      return sendError(
        res,
        'Định dạng ngày bắt đầu hoặc ngày kết thúc không hợp lệ.',
        null,
        400,
        ERROR_CODES.SCHEDULE_INVALID_DATA
      );
    }

    // 2. Validate ngày: bắt buộc endDate >= startDate
    if (newEnd < newStart) {
      return sendError(
        res,
        'Ngày kết thúc (endDate) không thể trước ngày bắt đầu (startDate).',
        null,
        400,
        ERROR_CODES.SCHEDULE_INVALID_DATA
      );
    }

    // 3. Kiểm tra ca làm việc có tồn tại không
    const shift = await ShiftConfig.findById(shiftId);
    if (!shift) {
      return sendError(
        res,
        'Ca làm việc chỉ định không tồn tại trên hệ thống.',
        null,
        404,
        ERROR_CODES.SHIFT_NOT_FOUND
      );
    }

    const effectiveStartTime = startTime || shift.startTime;
    const effectiveEndTime = endTime || shift.endTime;

    const newShiftStartMins = timeStringToMinutes(effectiveStartTime);
    const newShiftEndMins = timeStringToMinutes(effectiveEndTime);

    // 4. Thuật toán kiểm tra xung đột thời gian (Conflict Detection)
    // Điều kiện giao thoa 2 khoảng thời gian: max(start1, start2) < min(end1, end2)
    const existingSchedules = await Schedule.find({
      userId,
      weekday: weekdayNum,
      startDate: { $lte: newEnd },
      endDate: { $gte: newStart },
    }).populate('shiftId');

    for (const ex of existingSchedules) {
      const exStart = ex.startTime || (ex.shiftId ? ex.shiftId.startTime : null);
      const exEnd = ex.endTime || (ex.shiftId ? ex.shiftId.endTime : null);

      if (exStart && exEnd) {
        const exStartMins = timeStringToMinutes(exStart);
        const exEndMins = timeStringToMinutes(exEnd);

        if (Math.max(newShiftStartMins, exStartMins) < Math.min(newShiftEndMins, exEndMins)) {
          const weekdayLabel = weekdayNum === 0 ? 'Chủ nhật' : `Thứ ${weekdayNum + 1}`;
          return sendError(
            res,
            `Trùng lịch: Người dùng này đã có lịch vào ${weekdayLabel} (${exStart} - ${exEnd}) trong cùng khung thời gian học kỳ!`,
            null,
            409,
            ERROR_CODES.SCHEDULE_CONFLICT
          );
        }
      }
    }

    // 5. Tạo bản ghi Schedule mới
    const newSchedule = await Schedule.create({
      userId,
      shiftId,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      roomId: roomId || '',
      weekday: weekdayNum,
      isRecurring: isRecurring !== undefined ? isRecurring : true,
      startDate: newStart,
      endDate: newEnd,
    });

    const populated = await Schedule.findById(newSchedule._id)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes');

    return sendSuccess(res, 'Tạo lịch giảng dạy/công tác thành công.', populated, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật lịch phân công (Chỉ Admin hoặc Trưởng khoa)
 * Có kiểm tra chống trùng lịch (trừ chính bản ghi đang sửa)
 * PUT /api/schedules/:id
 */
const updateSchedule = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const existingSchedule = await Schedule.findById(scheduleId);
    if (!existingSchedule) {
      return sendError(
        res,
        'Không tìm thấy lịch để cập nhật.',
        null,
        404,
        ERROR_CODES.SCHEDULE_NOT_FOUND
      );
    }

    const {
      userId,
      shiftId,
      startTime,
      endTime,
      roomId,
      weekday,
      isRecurring,
      startDate,
      endDate,
    } = req.body;

    const targetUserId = userId || existingSchedule.userId;
    const targetWeekday = weekday !== undefined ? Number(weekday) : existingSchedule.weekday;
    const targetStart = startDate ? new Date(startDate) : existingSchedule.startDate;
    const targetEnd = endDate ? new Date(endDate) : existingSchedule.endDate;

    if (targetEnd < targetStart) {
      return sendError(
        res,
        'Ngày kết thúc (endDate) không thể trước ngày bắt đầu (startDate).',
        null,
        400,
        ERROR_CODES.SCHEDULE_INVALID_DATA
      );
    }

    let targetShiftId = shiftId || existingSchedule.shiftId;
    let targetStartTime = startTime || existingSchedule.startTime;
    let targetEndTime = endTime || existingSchedule.endTime;

    if (shiftId && shiftId.toString() !== existingSchedule.shiftId.toString()) {
      const shift = await ShiftConfig.findById(shiftId);
      if (!shift) {
        return sendError(
          res,
          'Ca làm việc chỉ định không tồn tại trên hệ thống.',
          null,
          404,
          ERROR_CODES.SHIFT_NOT_FOUND
        );
      }
      if (!startTime) targetStartTime = shift.startTime;
      if (!endTime) targetEndTime = shift.endTime;
    }

    const startMins = timeStringToMinutes(targetStartTime);
    const endMins = timeStringToMinutes(targetEndTime);

    // Kiểm tra trùng lịch với các lịch khác (loại trừ chính bản ghi đang sửa: _id != scheduleId)
    const otherSchedules = await Schedule.find({
      _id: { $ne: scheduleId },
      userId: targetUserId,
      weekday: targetWeekday,
      startDate: { $lte: targetEnd },
      endDate: { $gte: targetStart },
    }).populate('shiftId');

    for (const other of otherSchedules) {
      const otherStart = other.startTime || (other.shiftId ? other.shiftId.startTime : null);
      const otherEnd = other.endTime || (other.shiftId ? other.shiftId.endTime : null);

      if (otherStart && otherEnd) {
        const otherStartMins = timeStringToMinutes(otherStart);
        const otherEndMins = timeStringToMinutes(otherEnd);

        if (Math.max(startMins, otherStartMins) < Math.min(endMins, otherEndMins)) {
          const weekdayLabel = targetWeekday === 0 ? 'Chủ nhật' : `Thứ ${targetWeekday + 1}`;
          return sendError(
            res,
            `Trùng lịch: Người dùng này đã có lịch khác vào ${weekdayLabel} (${otherStart} - ${otherEnd}) trong cùng khung thời gian!`,
            null,
            409,
            ERROR_CODES.SCHEDULE_CONFLICT
          );
        }
      }
    }

    const updatePayload = {
      ...(userId ? { userId } : {}),
      ...(shiftId ? { shiftId: targetShiftId } : {}),
      ...(targetStartTime ? { startTime: targetStartTime } : {}),
      ...(targetEndTime ? { endTime: targetEndTime } : {}),
      ...(roomId !== undefined ? { roomId } : {}),
      ...(weekday !== undefined ? { weekday: targetWeekday } : {}),
      ...(isRecurring !== undefined ? { isRecurring } : {}),
      ...(startDate ? { startDate: targetStart } : {}),
      ...(endDate ? { endDate: targetEnd } : {}),
    };

    const updated = await Schedule.findByIdAndUpdate(scheduleId, updatePayload, {
      new: true,
      runValidators: true,
    })
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes');

    return sendSuccess(res, 'Cập nhật lịch thành công.', updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa một lịch phân công (Chỉ Admin hoặc Trưởng khoa)
 * DELETE /api/schedules/:id
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return sendError(
        res,
        'Không tìm thấy lịch để xóa.',
        null,
        404,
        ERROR_CODES.SCHEDULE_NOT_FOUND
      );
    }
    return sendSuccess(res, 'Xóa lịch thành công.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
