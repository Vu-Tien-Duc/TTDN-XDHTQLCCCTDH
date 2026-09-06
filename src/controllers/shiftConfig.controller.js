const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getAllShiftConfigs = async (req, res, next) => {
  try {
    const shiftConfigs = await ShiftConfig.find().sort({ startTime: 1 });
    return sendSuccess(res, 'Lấy danh sách ca làm việc thành công.', shiftConfigs);
  } catch (error) {
    next(error);
  }
};

const getShiftConfigById = async (req, res, next) => {
  try {
    const shiftConfig = await ShiftConfig.findById(req.params.id);
    if (!shiftConfig) {
      return sendError(res, 'Không tìm thấy ca làm việc.', null, 404);
    }
    return sendSuccess(res, 'Lấy chi tiết ca làm việc thành công.', shiftConfig);
  } catch (error) {
    next(error);
  }
};

const createShiftConfig = async (req, res, next) => {
  try {
    const { name, startTime, endTime, lateThresholdMinutes } = req.body;
    const newShift = await ShiftConfig.create({
      name,
      startTime,
      endTime,
      lateThresholdMinutes: lateThresholdMinutes !== undefined ? lateThresholdMinutes : 15,
    });
    return sendSuccess(res, 'Tạo mới ca làm việc thành công.', newShift, 201);
  } catch (error) {
    next(error);
  }
};

const updateShiftConfig = async (req, res, next) => {
  try {
    const updated = await ShiftConfig.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return sendError(res, 'Không tìm thấy ca làm việc để cập nhật.', null, 404);
    }
    return sendSuccess(res, 'Cập nhật ca làm việc thành công.', updated);
  } catch (error) {
    next(error);
  }
};

const deleteShiftConfig = async (req, res, next) => {
  try {
    // Kiểm tra ràng buộc nếu ca này đang được lịch tham chiếu
    const scheduleCount = await Schedule.countDocuments({ shiftId: req.params.id });
    if (scheduleCount > 0) {
      return sendError(
        res,
        `Không thể xóa ca làm việc vì đang được ${scheduleCount} lịch giảng dạy/công tác tham chiếu.`,
        null,
        400
      );
    }

    const deleted = await ShiftConfig.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return sendError(res, 'Không tìm thấy ca làm việc để xóa.', null, 404);
    }
    return sendSuccess(res, 'Xóa ca làm việc thành công.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
};
