const AttendanceLog = require('../models/attendanceLog.model');
const User = require('../models/user.model');

/**
 * Service tổng hợp báo cáo chấm công toàn trường hoặc theo Khoa
 */
const generateMonthlyReport = async (month, year, departmentId = null) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  let userFilter = { isActive: true };
  if (departmentId) {
    userFilter.departmentId = departmentId;
  }

  const users = await User.find(userFilter).select('_id fullName email role departmentId');
  const userIds = users.map((u) => u._id);

  const attendances = await AttendanceLog.find({
    userId: { $in: userIds },
    checkInTime: { $gte: startDate, $lte: endDate },
  });

  const reportData = users.map((user) => {
    const userAttendances = attendances.filter((a) => a.userId.toString() === user._id.toString());
    return {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
      },
      totalWorkingDays: userAttendances.length,
      onTimeCount: userAttendances.filter((a) => a.status === 'ON_TIME').length,
      lateCount: userAttendances.filter((a) => a.status === 'LATE').length,
      earlyLeaveCount: userAttendances.filter((a) => a.status === 'EARLY_LEAVE').length,
      absentCount: userAttendances.filter((a) => a.status === 'ABSENT').length,
      excusedCount: userAttendances.filter((a) => a.status === 'EXCUSED_ABSENCE').length,
    };
  });

  return reportData;
};

module.exports = {
  generateMonthlyReport,
};
