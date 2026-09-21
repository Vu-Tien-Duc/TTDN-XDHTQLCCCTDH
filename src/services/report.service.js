const AttendanceLog = require('../models/attendanceLog.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const { buildAttendanceDateFilter } = require('./attendance.service');

/**
 * Service tổng hợp báo cáo chấm công toàn trường hoặc theo Khoa
 * @param {number} month - Tháng (1-12)
 * @param {number} year - Năm (vd: 2026)
 * @param {string|Array<string>} departmentId - ID đơn vị hoặc danh sách ID đơn vị
 * @param {Object} options - Tùy chọn phân trang { page, limit }
 */
const generateMonthlyReport = async (month, year, departmentId = null, options = {}) => {
  const mStr = String(month).padStart(2, '0');
  // Tính chính xác ngày cuối cùng của tháng theo lịch dương
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  // Mốc thời gian bắt đầu và kết thúc tháng đúng theo múi giờ Việt Nam (Asia/Ho_Chi_Minh: UTC+07:00)
  const startDate = new Date(`${year}-${mStr}-01T00:00:00.000+07:00`);
  const endDate = new Date(`${year}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);

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

  const totalUsers = await User.countDocuments(userFilter);

  let userQuery = User.find(userFilter).select('_id fullName email role departmentId');

  const { page, limit } = options;
  if (page && limit) {
    const skip = (page - 1) * limit;
    userQuery = userQuery.skip(skip).limit(limit);
  } else {
    // Giới hạn an toàn tối đa 500 bản ghi để chống tràn RAM khi chạy quy mô lớn
    userQuery = userQuery.limit(500);
  }

  const users = await userQuery.lean();
  const userIds = users.map((u) => u._id);

  // Chỉ lấy các trường cần thiết phục vụ thống kê
  const dateFilter = buildAttendanceDateFilter(startDate, endDate);
  const attendances = await AttendanceLog.find({
    userId: { $in: userIds },
    ...dateFilter,
  })
    .select('userId status checkInTime createdAt')
    .lean();

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

  return {
    report: reportData,
    totalUsers,
    pagination: {
      page: page || 1,
      limit: limit || reportData.length,
      totalPages: limit ? Math.ceil(totalUsers / limit) || 1 : 1,
      totalUsers,
    },
  };
};

module.exports = {
  generateMonthlyReport,
};
