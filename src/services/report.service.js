const Attendance = require('../models/attendance.model');
const User = require('../models/user.model');

/**
 * Service tổng hợp báo cáo chấm công toàn trường hoặc theo Khoa
 */
const generateMonthlyReport = async (month, year, departmentId = null) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  let userFilter = {};
  if (departmentId) {
    userFilter.department = departmentId;
  }

  const users = await User.find(userFilter).select('_id userCode fullName role department');
  const userIds = users.map((u) => u._id);

  const attendances = await Attendance.find({
    user: { $in: userIds },
    checkInTime: { $gte: startDate, $lte: endDate },
  });

  const reportData = users.map((user) => {
    const userAttendances = attendances.filter((a) => a.user.toString() === user._id.toString());
    return {
      user: {
        id: user._id,
        userCode: user.userCode,
        fullName: user.fullName,
      },
      totalWorkingDays: userAttendances.length,
      onTimeCount: userAttendances.filter((a) => a.status === 'ON_TIME').length,
      lateCount: userAttendances.filter((a) => a.status === 'LATE').length,
      absentCount: userAttendances.filter((a) => a.status === 'ABSENT').length,
    };
  });

  return reportData;
};

module.exports = {
  generateMonthlyReport,
};
