const AttendanceLog = require('../models/attendanceLog.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const { buildAttendanceDateFilter } = require('./attendance.service');

/**
 * Service tổng hợp báo cáo chấm công toàn trường hoặc theo Khoa
 * Bao gồm cả Khoa cha và các Bộ môn con trực thuộc khoa
 */
const generateMonthlyReport = async (month, year, departmentId = null) => {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  let userFilter = { isActive: true };
  if (departmentId) {
    if (Array.isArray(departmentId)) {
      userFilter.departmentId = { $in: departmentId };
    } else {
      const childDepts = await Department.find({ parentId: departmentId }).select('_id');
      const allDeptIds = [departmentId, ...childDepts.map((d) => d._id)];
      userFilter.departmentId = { $in: allDeptIds };
    }
  }

  const users = await User.find(userFilter).select('_id fullName email role departmentId');
  const userIds = users.map((u) => u._id);

  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  const attendances = await AttendanceLog.find({
    userId: { $in: userIds },
    ...dateFilter,
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

  // Tính xu hướng chuyên cần theo 4 tuần trong tháng hoàn toàn từ dữ liệu MongoDB thật
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekRanges = [
    { label: 'Tuần 1', start: 1, end: 7 },
    { label: 'Tuần 2', start: 8, end: 14 },
    { label: 'Tuần 3', start: 15, end: 21 },
    { label: 'Tuần 4', start: 22, end: daysInMonth },
  ];

  const weeklyTrend = weekRanges.map(({ label, start, end }) => {
    const wStart = new Date(year, month - 1, start, 0, 0, 0, 0);
    const wEnd = new Date(year, month - 1, end, 23, 59, 59, 999);

    const weekLogs = attendances.filter((a) => {
      const t = a.checkInTime ? new Date(a.checkInTime) : (a.createdAt ? new Date(a.createdAt) : null);
      return t && t >= wStart && t <= wEnd;
    });

    const total = weekLogs.length;
    const onTime = weekLogs.filter((a) => a.status === 'ON_TIME' || a.status === 'EXCUSED_ABSENCE').length;
    const late = weekLogs.filter((a) => a.status === 'LATE' || a.status === 'EARLY_LEAVE').length;

    const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
    const lateRate = total > 0 ? Math.round((late / total) * 100) : 0;

    return { label, rate, lateRate };
  });

  return {
    report: reportData,
    weeklyTrend,
  };
};

module.exports = {
  generateMonthlyReport,
};
