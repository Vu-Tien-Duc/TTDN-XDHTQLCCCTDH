const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ERROR_CODES = require('../utils/errorCodes');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Lấy danh sách tất cả các ca làm việc chuẩn (sắp xếp theo giờ bắt đầu)
 * GET /api/shifts
 */
const getAllShiftConfigs = async (req, res, next) => {
  try {
    const shiftConfigs = await ShiftConfig.find().sort({ startTime: 1 });
    return sendSuccess(res, 'Lấy danh sách ca làm việc thành công.', shiftConfigs);
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thông tin chi tiết một ca làm việc theo ID
 * GET /api/shifts/:id
 */
const getShiftConfigById = async (req, res, next) => {
  try {
    const shiftConfig = await ShiftConfig.findById(req.params.id);
    if (!shiftConfig) {
      return sendError(
        res,
        'Không tìm thấy ca làm việc.',
        null,
        404,
        ERROR_CODES.SHIFT_NOT_FOUND
      );
    }
    return sendSuccess(res, 'Lấy chi tiết ca làm việc thành công.', shiftConfig);
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo mới một ca làm việc chuẩn (Chỉ Admin)
 * POST /api/shifts
 */
const createShiftConfig = async (req, res, next) => {
  try {
    const { name, startTime, endTime, lateThresholdMinutes } = req.body;

    // 1. Validate các trường bắt buộc
    if (!name || !startTime || !endTime) {
      return sendError(
        res,
        'Vui lòng cung cấp đầy đủ tên ca (name), giờ bắt đầu (startTime) và giờ kết thúc (endTime).',
        null,
        400,
        ERROR_CODES.SHIFT_INVALID_DATA
      );
    }

    // 2. Validate định dạng giờ HH:mm
    if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
      return sendError(
        res,
        'Định dạng giờ bắt đầu hoặc giờ kết thúc không hợp lệ (yêu cầu định dạng HH:mm, từ 00:00 đến 23:59).',
        null,
        400,
        ERROR_CODES.SHIFT_INVALID_DATA
      );
    }

    // 3. Validate ngưỡng trễ cho phép
    const lateThreshold = lateThresholdMinutes !== undefined ? Number(lateThresholdMinutes) : 15;
    if (isNaN(lateThreshold) || lateThreshold < 0) {
      return sendError(
        res,
        'Ngưỡng phút trễ (lateThresholdMinutes) phải là số không âm.',
        null,
        400,
        ERROR_CODES.SHIFT_INVALID_DATA
      );
    }

    // 4. Chặn tạo trùng tên ca (Mã lỗi SHIFT_004)
    const existingShift = await ShiftConfig.findOne({ name: name.trim() });
    if (existingShift) {
      return sendError(
        res,
        `Ca làm việc có tên "${name}" đã tồn tại trên hệ thống.`,
        null,
        409,
        ERROR_CODES.SHIFT_DUPLICATE
      );
    }

    const newShift = await ShiftConfig.create({
      name: name.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      lateThresholdMinutes: lateThreshold,
    });

    return sendSuccess(res, 'Tạo mới ca làm việc thành công.', newShift, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật thông tin ca làm việc (Chỉ Admin)
 * PUT /api/shifts/:id
 */
const updateShiftConfig = async (req, res, next) => {
  try {
    const { name, startTime, endTime, lateThresholdMinutes } = req.body;

    if (startTime && !TIME_REGEX.test(startTime)) {
      return sendError(
        res,
        'Định dạng giờ bắt đầu không hợp lệ (yêu cầu định dạng HH:mm).',
        null,
        400,
        ERROR_CODES.SHIFT_INVALID_DATA
      );
    }

    if (endTime && !TIME_REGEX.test(endTime)) {
      return sendError(
        res,
        'Định dạng giờ kết thúc không hợp lệ (yêu cầu định dạng HH:mm).',
        null,
        400,
        ERROR_CODES.SHIFT_INVALID_DATA
      );
    }

    if (lateThresholdMinutes !== undefined && (isNaN(Number(lateThresholdMinutes)) || Number(lateThresholdMinutes) < 0)) {
      return sendError(
        res,
        'Ngưỡng phút trễ (lateThresholdMinutes) phải là số không âm.',
        null,
        400,
        ERROR_CODES.SHIFT_INVALID_DATA
      );
    }

    // Kiểm tra trùng tên ca với ca khác nếu có sửa tên
    if (name) {
      const duplicateShift = await ShiftConfig.findOne({
        _id: { $ne: req.params.id },
        name: name.trim(),
      });
      if (duplicateShift) {
        return sendError(
          res,
          `Tên ca "${name}" đã được sử dụng bởi ca làm việc khác.`,
          null,
          409,
          ERROR_CODES.SHIFT_DUPLICATE
        );
      }
    }

    const updated = await ShiftConfig.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return sendError(
        res,
        'Không tìm thấy ca làm việc để cập nhật.',
        null,
        404,
        ERROR_CODES.SHIFT_NOT_FOUND
      );
    }

    return sendSuccess(res, 'Cập nhật ca làm việc thành công.', updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa ca làm việc (Chỉ Admin)
 * Logic nghiệp vụ quan trọng: Kiểm tra nếu có lịch giảng dạy đang liên kết thì chặn xóa (SHIFT_002)
 * DELETE /api/shifts/:id
 */
const deleteShiftConfig = async (req, res, next) => {
  try {
    // Kiểm tra ràng buộc: có lịch nào đang sử dụng ca này không
    const scheduleCount = await Schedule.countDocuments({ shiftId: req.params.id });
    if (scheduleCount > 0) {
      return sendError(
        res,
        `Không thể xóa ca làm việc vì đang được ${scheduleCount} lịch giảng dạy/công tác tham chiếu.`,
        null,
        400,
        ERROR_CODES.SHIFT_IN_USE
      );
    }

    const deleted = await ShiftConfig.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return sendError(
        res,
        'Không tìm thấy ca làm việc để xóa.',
        null,
        404,
        ERROR_CODES.SHIFT_NOT_FOUND
      );
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
