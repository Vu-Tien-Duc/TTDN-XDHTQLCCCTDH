const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { calculateLeaveDays } = require('./leaveRequest.controller');
const { buildAttendanceDateFilter } = require('../services/attendance.service');
const { getDeanDepartmentIds, getDeanScopedUserIds } = require('../utils/deanScope');

/**
 * @desc Thống kê báo cáo chấm công
 * @route GET /api/reports/attendance
 */
const getAttendanceReport = async (req, res, next) => {
  try {
    const { userId, departmentId, from, to } = req.query;

    let targetUserIds = [];

    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      targetUserIds = [req.user.id];
    } else if (req.user.role === 'truongkhoa') {
      const allFacultyIds = await getDeanScopedUserIds(req.user);

      if (userId) {
        if (!allFacultyIds.includes(userId.toString())) {
          return sendError(res, 'Bạn không có quyền xem thống kê của nhân sự ngoài khoa.', null, 403);
        }
        targetUserIds = [userId];
      } else {
        targetUserIds = allFacultyIds;
      }
    } else if (req.user.role === 'admin') {
      if (userId) {
        targetUserIds = [userId];
      } else if (departmentId) {
        const deptUsers = await User.find({ departmentId }).select('_id');
        targetUserIds = deptUsers.map((u) => u._id);
      } else {
        const allUsers = await User.find({ isActive: true }).select('_id');
        targetUserIds = allUsers.map((u) => u._id);
      }
    }

    const attendanceQuery = { userId: { $in: targetUserIds } };
    if (from || to) {
      const dateFilter = buildAttendanceDateFilter(from, to);
      Object.assign(attendanceQuery, dateFilter);
    }

    const attendances = await AttendanceLog.find(attendanceQuery);

    // Tính số đơn nghỉ phép được duyệt trong khoảng thời gian này
    const leaveQuery = {
      userId: { $in: targetUserIds },
      status: 'APPROVED',
      type: 'nghi_phep',
    };
    if (from || to) {
      leaveQuery.startDate = {};
      if (from) leaveQuery.startDate.$gte = new Date(from);
      if (to) leaveQuery.startDate.$lte = new Date(to);
    }
    const approvedLeaves = await LeaveRequest.find(leaveQuery);

    // Tổng hợp thống kê
    const summary = {
      totalRecords: attendances.length,
      onTimeCount: attendances.filter((a) => a.status === 'ON_TIME').length,
      lateCount: attendances.filter((a) => a.status === 'LATE').length,
      earlyLeaveCount: attendances.filter((a) => a.status === 'EARLY_LEAVE').length,
      absentCount: attendances.filter((a) => a.status === 'ABSENT').length,
      excusedAbsenceCount: attendances.filter((a) => a.status === 'EXCUSED_ABSENCE').length,
      approvedLeaveDays: approvedLeaves.reduce((sum, item) => {
        return sum + calculateLeaveDays(item.startDate, item.endDate);
      }, 0),
    };

    return sendSuccess(res, 'Lấy báo cáo thống kê chấm công thành công.', summary);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Báo cáo thống kê chấm công theo tháng cho Admin và Trưởng khoa
 * @route GET /api/reports/monthly
 */
const getMonthlyReport = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    let departmentFilter = req.query.departmentId || null;

    if (req.user.role === 'truongkhoa') {
      const scopeDeptIds = await getDeanDepartmentIds(req.user);
      if (departmentFilter) {
        if (!scopeDeptIds.some((id) => id.toString() === departmentFilter.toString())) {
          return sendError(res, 'Bạn không có quyền xem báo cáo của đơn vị ngoài khoa.', null, 403);
        }
      } else {
        departmentFilter = scopeDeptIds;
      }
    }

    const { generateMonthlyReport } = require('../services/report.service');
    const data = await generateMonthlyReport(month, year, departmentFilter);

    return sendSuccess(res, `Lấy báo cáo tổng hợp tháng ${month}/${year} thành công.`, {
      month,
      year,
      totalUsers: data.length,
      report: data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceReport,
  getMonthlyReport,
};
