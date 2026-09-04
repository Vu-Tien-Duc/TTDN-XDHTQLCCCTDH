const Attendance = require('../models/attendance.model');
const Schedule = require('../models/schedule.model');
const { calculateAttendanceStatus, getAttendanceSummaryByUser } = require('../services/attendance.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * @desc Thực hiện Check-in / Điểm danh
 * @route POST /api/v1/attendance/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { scheduleId, method, locationData, note } = req.body;

    const checkInTime = new Date();
    let status = 'ON_TIME';

    if (scheduleId) {
      const schedule = await Schedule.findById(scheduleId);
      if (schedule) {
        // Tùy chọn kiểm tra giờ trễ trôi qua service
        const scheduleDateTime = new Date(`${schedule.date.toISOString().split('T')[0]}T${schedule.startTime}:00`);
        status = calculateAttendanceStatus(checkInTime, scheduleDateTime);
      }
    }

    const attendance = await Attendance.create({
      user: userId,
      schedule: scheduleId || null,
      checkInTime,
      method: method || 'QR_CODE',
      status,
      locationData,
      note,
    });

    return sendSuccess(res, 'Chấm công Check-in thành công.', attendance, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Thực hiện Check-out
 * @route POST /api/v1/attendance/check-out/:id
 */
const checkOut = async (req, res, next) => {
  try {
    const attendanceId = req.params.id;
    const attendance = await Attendance.findById(attendanceId);

    if (!attendance) {
      return sendError(res, 'Không tìm thấy bản ghi chấm công.', null, 404);
    }

    attendance.checkOutTime = new Date();
    await attendance.save();

    return sendSuccess(res, 'Chấm công Check-out thành công.', attendance);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Lấy danh sách chấm công cá nhân hoặc quản lý
 * @route GET /api/v1/attendance
 */
const getAttendanceRecords = async (req, res, next) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const targetUserId = userId || req.user.id;

    const summary = await getAttendanceSummaryByUser(targetUserId, startDate, endDate);
    return sendSuccess(res, 'Lấy danh sách chấm công thành công.', summary);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkIn,
  checkOut,
  getAttendanceRecords,
};
