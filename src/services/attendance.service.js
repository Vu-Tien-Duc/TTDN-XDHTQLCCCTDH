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
 * Xác định khoảng thời gian đầu ngày và cuối ngày [00:00:00.000, 23:59:59.999] theo chuẩn múi giờ UTC+7 (Asia/Ho_Chi_Minh)
 * @param {Date} [date=new Date()]
 * @returns {{ startOfDay: Date, endOfDay: Date, dateStr: string }}
 */
const getVietnamDayRange = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // Định dạng YYYY-MM-DD
  const startOfDay = new Date(`${dateStr}T00:00:00.000+07:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { startOfDay, endOfDay, dateStr };
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
 * Đánh giá trạng thái khi Check-out:
 * - So sánh giờ check-out thực tế với endTime của ca làm việc
 * - Nếu về trước endTime:
 *   + Nếu trạng thái ban đầu là ON_TIME -> Chuyển thành EARLY_LEAVE
 *   + Nếu trạng thái ban đầu là LATE -> Giữ nguyên LATE
 * @param {Date} checkOutTime 
 * @param {Object} shiftConfig 
 * @param {String} initialStatus - 'ON_TIME' | 'LATE'
 * @returns {Object} { finalStatus, isEarlyLeave, earlyMinutes }
 */
const calculateCheckOutStatus = (checkOutTime, shiftConfig, initialStatus = 'ON_TIME') => {
  if (!shiftConfig || !shiftConfig.endTime) {
    return { finalStatus: initialStatus, isEarlyLeave: false, earlyMinutes: 0 };
  }

  const vnDate = getVietnamTime(checkOutTime);
  const checkOutMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const shiftEndMinutes = timeStringToMinutes(shiftConfig.endTime);

  const isEarlyLeave = checkOutMinutes < shiftEndMinutes;
  const earlyMinutes = isEarlyLeave ? shiftEndMinutes - checkOutMinutes : 0;

  // Quy tắc nghiệp vụ: Nếu ban đầu ON_TIME mà về sớm -> EARLY_LEAVE. Nếu ban đầu đã LATE -> giữ nguyên LATE
  let finalStatus = initialStatus;
  if (isEarlyLeave && initialStatus === 'ON_TIME') {
    finalStatus = 'EARLY_LEAVE';
  }

  return {
    finalStatus,
    isEarlyLeave,
    earlyMinutes,
  };
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
  getVietnamDayRange,
  timeStringToMinutes,
  getTodayScheduleWindow,
  calculateAttendanceStatus,
  calculateCheckOutStatus,
  getAttendanceSummaryByUser,
};
