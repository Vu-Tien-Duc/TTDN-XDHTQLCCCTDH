const AttendanceLog = require('../models/attendanceLog.model');
const ShiftConfig = require('../models/shiftConfig.model');

/**
 * Chuyển đổi mốc thời gian về múi giờ chuẩn Asia/Ho_Chi_Minh (UTC+7)
 * Khắc phục triệt để lỗi lệch 7 tiếng của server runtime
 * @param {Date} [date=new Date()]
 * @returns {Date}
 */
const getVietnamTime = (date = new Date()) => {
  const vnTimeString = date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Date(vnTimeString);
};

/**
 * Bóc tách chuỗi "HH:mm" thành tổng số phút trong ngày tính từ 00:00 để so sánh toán học
 * @param {string} timeStr - Chuỗi định dạng "HH:mm"
 * @returns {number} Số phút từ 00:00
 */
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Xác định khung giờ check-in hợp lệ cho ca làm việc: từ startTime - 30 phút đến endTime
 * @param {Object} shift - Bản ghi ca làm việc (chứa startTime, endTime)
 * @returns {Object|null} { startMinutes, endMinutes, windowStartMinutes, windowEndMinutes }
 */
const getTodayScheduleWindow = (shift) => {
  if (!shift || !shift.startTime || !shift.endTime) return null;
  const startMinutes = timeStringToMinutes(shift.startTime);
  const endMinutes = timeStringToMinutes(shift.endTime);
  return {
    startMinutes,
    endMinutes,
    windowStartMinutes: startMinutes - 30,
    windowEndMinutes: endMinutes,
  };
};

/**
 * Tính toán trạng thái chấm công dựa vào thời điểm check-in và cấu hình ca
 * @param {Date} checkInTime 
 * @param {Object} shiftConfig 
 * @param {Date} [date=new Date()] (ngày áp dụng)
 * @returns {String} 'ON_TIME' | 'LATE'
 */
const calculateAttendanceStatus = (checkInTime, shiftConfig, date = new Date()) => {
  if (!shiftConfig || !shiftConfig.startTime) return 'ON_TIME';

  const vnDate = getVietnamTime(checkInTime || date);
  const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const startMinutes = timeStringToMinutes(shiftConfig.startTime);
  const lateThreshold = shiftConfig.lateThresholdMinutes !== undefined ? shiftConfig.lateThresholdMinutes : 15;

  if (currentMinutes > startMinutes + lateThreshold) {
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
  getVietnamTime,
  timeStringToMinutes,
  getTodayScheduleWindow,
  calculateAttendanceStatus,
  getAttendanceSummaryByUser,
};

