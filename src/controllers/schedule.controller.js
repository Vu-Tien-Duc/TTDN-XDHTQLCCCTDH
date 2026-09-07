const Schedule = require('../models/schedule.model');
const ShiftConfig = require('../models/shiftConfig.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const timeStringToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getSchedules = async (req, res, next) => {
  try {
    const { userId, shiftId, weekday, startDate, endDate, date } = req.query;
    const query = {};

    if (userId) query.userId = userId;
    else if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      // Giảng viên / nhân viên chỉ xem lịch của chính mình
      query.userId = req.user.id;
    }

    if (shiftId) query.shiftId = shiftId;
    if (weekday !== undefined) query.weekday = Number(weekday);

    // Lọc theo khung học kỳ
    if (startDate && endDate) {
      query.startDate = { $lte: new Date(endDate) };
      query.endDate = { $gte: new Date(startDate) };
    } else if (date) {
      const targetDate = new Date(date);
      query.startDate = { $lte: targetDate };
      query.endDate = { $gte: targetDate };
    }

    const schedules = await Schedule.find(query)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .sort({ weekday: 1, startDate: 1 });

    return sendSuccess(res, 'Lấy danh sách lịch phân công thành công.', schedules);
  } catch (error) {
    next(error);
  }
};

const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes');

    if (!schedule) {
      return sendError(res, 'Không tìm thấy lịch.', null, 404);
    }
    return sendSuccess(res, 'Lấy chi tiết lịch thành công.', schedule);
  } catch (error) {
    next(error);
  }
};

const createSchedule = async (req, res, next) => {
  try {
    const { userId, shiftId, roomId, weekday, isRecurring, startDate, endDate } = req.body;

    // BẮT BUỘC truyền startDate/endDate (khung học kỳ)
    if (!userId || !shiftId || weekday === undefined || !startDate || !endDate) {
      return sendError(res, 'Vui lòng cung cấp đầy đủ userId, shiftId, weekday, startDate, endDate.', null, 400);
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    if (newEnd < newStart) {
      return sendError(res, 'Ngày kết thúc (endDate) không thể trước ngày bắt đầu (startDate).', null, 400);
    }

    const newShift = await ShiftConfig.findById(shiftId);
    if (!newShift) {
      return sendError(res, 'Ca làm việc chỉ định không tồn tại.', null, 404);
    }

    const newShiftStartMins = timeStringToMinutes(newShift.startTime);
    const newShiftEndMins = timeStringToMinutes(newShift.endTime);

    // Validate: không cho phép 2 lịch của cùng user trùng khung giờ
    const existingSchedules = await Schedule.find({
      userId,
      weekday: Number(weekday),
      startDate: { $lte: newEnd },
      endDate: { $gte: newStart },
    }).populate('shiftId');

    for (const ex of existingSchedules) {
      if (ex.shiftId) {
        const exStartMins = timeStringToMinutes(ex.shiftId.startTime);
        const exEndMins = timeStringToMinutes(ex.shiftId.endTime);

        // Kiểm tra chồng lấn thời gian ca
        if (Math.max(newShiftStartMins, exStartMins) < Math.min(newShiftEndMins, exEndMins)) {
          return sendError(
            res,
            `Trùng lịch: Người dùng này đã có lịch vào Thứ ${Number(weekday) === 0 ? 'CN' : Number(weekday) + 1} (${ex.shiftId.startTime} - ${ex.shiftId.endTime}) trong cùng khung ngày!`,
            null,
            400
          );
        }
      }
    }

    const newSchedule = await Schedule.create({
      userId,
      shiftId,
      roomId: roomId || '',
      weekday: Number(weekday),
      isRecurring: isRecurring !== undefined ? isRecurring : true,
      startDate: newStart,
      endDate: newEnd,
    });

    const populated = await Schedule.findById(newSchedule._id)
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime');

    return sendSuccess(res, 'Tạo lịch giảng dạy/công tác thành công.', populated, 201);
  } catch (error) {
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('userId', 'fullName email')
      .populate('shiftId', 'name startTime endTime');

    if (!updated) {
      return sendError(res, 'Không tìm thấy lịch để cập nhật.', null, 404);
    }
    return sendSuccess(res, 'Cập nhật lịch thành công.', updated);
  } catch (error) {
    next(error);
  }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return sendError(res, 'Không tìm thấy lịch để xóa.', null, 404);
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
