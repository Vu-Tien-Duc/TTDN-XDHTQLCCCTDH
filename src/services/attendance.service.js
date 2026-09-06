const AttendanceLog = require('../models/attendanceLog.model');
const ShiftConfig = require('../models/shiftConfig.model');

/**
 * Tính toán trạng thái chấm công dựa vào thời điểm check-in và cấu hình ca
 * @param {Date} checkInTime 
 * @param {Object} shiftConfig 
 * @param {Date} date (ngày áp dụng)
 * @returns {String} 'ON_TIME' | 'LATE'
 */
const calculateAttendanceStatus = (checkInTime, shiftConfig, date = new Date()) => {
  if (!shiftConfig || !shiftConfig.startTime) return 'ON_TIME';

  const [shiftHour, shiftMinute] = shiftConfig.startTime.split(':').map(Number);
  const scheduledTime = new Date(date);
  scheduledTime.setHours(shiftHour, shiftMinute, 0, 0);

  const lateThresholdMs = (shiftConfig.lateThresholdMinutes || 15) * 60 * 1000;
  const checkIn = new Date(checkInTime);

  if (checkIn.getTime() > scheduledTime.getTime() + lateThresholdMs) {
    return 'LATE';
  }
  return 'ON_TIME';
};

/**
 * Lấy tổng hợp thống kê chấm công theo người dùng
 */
const getAttendanceSummaryByUser = async (userId, startDate, endDate) => {
  const query = { userId };
  if (startDate && endDate) {
    query.checkInTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const records = await AttendanceLog.find(query)
    .populate('shiftId', 'name startTime endTime')
    .populate('scheduleId', 'roomId weekday')
    .sort({ checkInTime: -1 });

  const summary = {
    totalRecords: records.length,
    onTimeCount: records.filter((r) => r.status === 'ON_TIME').length,
    lateCount: records.filter((r) => r.status === 'LATE').length,
    earlyLeaveCount: records.filter((r) => r.status === 'EARLY_LEAVE').length,
    absentCount: records.filter((r) => r.status === 'ABSENT').length,
    excusedCount: records.filter((r) => r.status === 'EXCUSED_ABSENCE').length,
    records,
  };

  return summary;
};

module.exports = {
  calculateAttendanceStatus,
  getAttendanceSummaryByUser,
};
