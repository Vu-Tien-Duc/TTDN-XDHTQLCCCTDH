const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
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
        const childDepts = await Department.find({ parentId: departmentId }).select('_id');
        const allDeptIds = [departmentId, ...childDepts.map((d) => d._id)];
        const deptUsers = await User.find({ departmentId: { $in: allDeptIds } }).select('_id');
        targetUserIds = deptUsers.map((u) => u._id);
      } else {
        const allUsers = await User.find({ isActive: true }).select('_id');
        targetUserIds = allUsers.map((u) => u._id);
      }
    }

    // Chuẩn hóa mốc thời gian from - to chuẩn xác cả ngày
    let fromDate = from ? new Date(from) : null;
    let toDate = null;
    if (to) {
      toDate = new Date(to);
      if (typeof to === 'string' && to.length <= 10) {
        toDate.setHours(23, 59, 59, 999);
      }
    }

    const attendanceQuery = { userId: { $in: targetUserIds } };
    if (fromDate || toDate) {
      const dateFilter = buildAttendanceDateFilter(fromDate, toDate);
      Object.assign(attendanceQuery, dateFilter);
    }

    const attendances = await AttendanceLog.find(attendanceQuery);

    // Tính số đơn nghỉ phép được duyệt trong khoảng thời gian này (Giao thoa khoảng ngày chuẩn xác)
    const leaveQuery = {
      userId: { $in: targetUserIds },
      status: 'APPROVED',
      type: 'nghi_phep',
    };
    if (fromDate) leaveQuery.endDate = { $gte: fromDate };
    if (toDate) leaveQuery.startDate = { $lte: toDate };

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
        const effectiveStart = fromDate ? new Date(Math.max(item.startDate.getTime(), fromDate.getTime())) : item.startDate;
        const effectiveEnd = toDate ? new Date(Math.min(item.endDate.getTime(), toDate.getTime())) : item.endDate;
        return sum + calculateLeaveDays(effectiveStart, effectiveEnd);
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
    const result = await generateMonthlyReport(month, year, departmentFilter);
    const reportList = result.report || result;
    const weeklyTrend = result.weeklyTrend || [];

    return sendSuccess(res, `Lấy báo cáo tổng hợp tháng ${month}/${year} thành công.`, {
      month,
      year,
      totalUsers: result.totalUsers !== undefined ? result.totalUsers : reportList.length,
      report: reportList,
      weeklyTrend: result.weeklyTrend || weeklyTrend,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Lấy dữ liệu trích xuất báo cáo Excel 5 Sheets đầy đủ
 * @route GET /api/reports/export-data
 */
const getExportReportData = async (req, res, next) => {
  try {
    const { userId, departmentId, from, to } = req.query;

    let month = undefined;
    if (req.query.month !== undefined && req.query.month !== '') {
      const parsedMonth = parseInt(req.query.month, 10);
      if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        month = parsedMonth;
      }
    }

    let year = undefined;
    if (req.query.year !== undefined && req.query.year !== '') {
      const parsedYear = parseInt(req.query.year, 10);
      if (!isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
        year = parsedYear;
      }
    }

    let targetUserIds = [];
    let deptFilter = departmentId || null;

    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      targetUserIds = [req.user.id];
    } else if (req.user.role === 'truongkhoa') {
      const allFacultyIds = await getDeanScopedUserIds(req.user);
      const scopeDeptIds = await getDeanDepartmentIds(req.user);

      if (userId) {
        if (!allFacultyIds.includes(userId.toString())) {
          return sendError(res, 'Bạn không có quyền xuất dữ liệu của nhân sự ngoài khoa.', null, 403);
        }
        targetUserIds = [userId];
      } else {
        targetUserIds = allFacultyIds;
      }

      if (departmentId) {
        if (!scopeDeptIds.some((id) => id.toString() === departmentId.toString())) {
          return sendError(res, 'Bạn không có quyền xuất báo cáo của đơn vị ngoài khoa.', null, 403);
        }
        deptFilter = departmentId;
      } else {
        deptFilter = scopeDeptIds;
      }
    } else if (req.user.role === 'admin') {
      if (userId) {
        targetUserIds = [userId];
      }
    }

    const { generateExportReportData } = require('../services/report.service');
    const exportData = await generateExportReportData({
      month,
      year,
      from,
      to,
      departmentId: deptFilter,
      targetUserIds,
    });

    return sendSuccess(res, 'Trích xuất dữ liệu báo cáo Excel thành công.', exportData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceReport,
  getMonthlyReport,
  getExportReportData,
};

