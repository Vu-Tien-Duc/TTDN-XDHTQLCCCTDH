const Schedule = require('../models/schedule.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getSchedules = async (req, res, next) => {
  try {
    const { lecturerId, date, status } = req.query;
    const query = {};

    if (lecturerId) query.lecturer = lecturerId;
    if (status) query.status = status;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const schedules = await Schedule.find(query).populate('lecturer', 'fullName userCode title').sort({ date: 1, startTime: 1 });
    return sendSuccess(res, 'Lấy lịch phân công thành công.', schedules);
  } catch (error) {
    next(error);
  }
};

const createSchedule = async (req, res, next) => {
  try {
    const newSchedule = await Schedule.create(req.body);
    return sendSuccess(res, 'Tạo lịch dạy/công tác thành công.', newSchedule, 201);
  } catch (error) {
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
