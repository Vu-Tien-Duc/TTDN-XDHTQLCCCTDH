const Attendance = require('../models/attendance.model');

/**
 * Service tính toán trạng thái đi muộn / về sớm cho chấm công
 */
const calculateAttendanceStatus = (checkInTime, scheduledStartTime) => {
  const checkIn = new Date(checkInTime);
  const scheduled = new Date(scheduledStartTime);

  // Cho phép trễ tối đa 15 phút
  const gracePeriodMs = 15 * 60 * 1000;

  if (checkIn.getTime() > scheduled.getTime() + gracePeriodMs) {
    return 'LATE';
  }
  return 'ON_TIME';
};

/**
 * Service lấy tổng hợp thống kê chấm công theo người dùng
 */
const getAttendanceSummaryByUser = async (userId, startDate, endDate) => {
  const query = { user: userId };
  if (startDate && endDate) {
    query.checkInTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const records = await Attendance.find(query).sort({ checkInTime: -1 });

  const summary = {
    totalRecords: records.length,
    onTimeCount: records.filter((r) => r.status === 'ON_TIME').length,
    lateCount: records.filter((r) => r.status === 'LATE').length,
    absentCount: records.filter((r) => r.status === 'ABSENT').length,
    records,
  };

  return summary;
};

module.exports = {
  calculateAttendanceStatus,
  getAttendanceSummaryByUser,
};
