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

    let fromDate = null;
    let toDate = null;

    if (from) {
      fromDate = typeof from === 'string' && from.length === 10
        ? new Date(`${from}T00:00:00.000+07:00`)
        : new Date(from);
      if (isNaN(fromDate.getTime())) {
        return sendError(res, 'Ngày bắt đầu (from) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', null, 400);
      }
    }
    if (to) {
      toDate = typeof to === 'string' && to.length === 10
        ? new Date(`${to}T23:59:59.999+07:00`)
        : new Date(to);
      if (isNaN(toDate.getTime())) {
        return sendError(res, 'Ngày kết thúc (to) không đúng định dạng ngày hợp lệ (YYYY-MM-DD).', null, 400);
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      return sendError(
        res,
        'Khoảng thời gian không hợp lệ: Ngày bắt đầu (from) phải nhỏ hơn hoặc bằng ngày kết thúc (to).',
        null,
        400
      );
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
    if (fromDate || toDate) {
      leaveQuery.startDate = {};
      if (fromDate) leaveQuery.startDate.$gte = fromDate;
      if (toDate) leaveQuery.startDate.$lte = toDate;
    }
    const approvedLeaves = await LeaveRequest.find(leaveQuery);

    // Tính toán xu hướng theo tuần thực tế (Weekly Trend)
    const year = fromDate ? fromDate.getFullYear() : new Date().getFullYear();
    const month = fromDate ? fromDate.getMonth() : new Date().getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    const weekRanges = [
      { label: 'Tuần 1', startDay: 1, endDay: 7 },
      { label: 'Tuần 2', startDay: 8, endDay: 14 },
      { label: 'Tuần 3', startDay: 15, endDay: 21 },
      { label: 'Tuần 4', startDay: 22, endDay: lastDayOfMonth },
    ];

    const weeklyTrend = weekRanges.map((w) => {
      const wStart = new Date(year, month, w.startDay, 0, 0, 0, 0);
      const wEnd = new Date(year, month, w.endDay, 23, 59, 59, 999);

      const logsInWeek = attendances.filter((a) => {
        const d = a.checkInTime ? new Date(a.checkInTime) : null;
        return d && d >= wStart && d <= wEnd;
      });

      const totalInWeek = logsInWeek.length;
      const onTimeInWeek = logsInWeek.filter((a) => a.status === 'ON_TIME').length;
      const lateInWeek = logsInWeek.filter((a) => a.status === 'LATE').length;
      const excusedInWeek = logsInWeek.filter((a) => a.status === 'EXCUSED_ABSENCE').length;

      const validInWeek = onTimeInWeek + excusedInWeek;
      const rate = totalInWeek > 0 ? Math.round((validInWeek / totalInWeek) * 100) : 0;
      const lateRate = totalInWeek > 0 ? Math.round((lateInWeek / totalInWeek) * 100) : 0;

      return {
        label: w.label,
        subLabel: `${String(w.startDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} - ${String(w.endDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`,
        rate,
        lateRate,
        total: totalInWeek,
        onTime: onTimeInWeek,
        late: lateInWeek,
      };
    });

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
      weeklyTrend,
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
    let month;
    if (req.query.month !== undefined && req.query.month !== '') {
      const parsedMonth = parseInt(req.query.month, 10);
      if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return sendError(res, 'Tháng (month) không hợp lệ. Vui lòng cung cấp số nguyên từ 1 đến 12.', null, 400);
      }
      month = parsedMonth;
    } else {
      // Mặc định tháng hiện tại theo múi giờ Việt Nam (UTC+7)
      const nowVn = new Date(Date.now() + 7 * 60 * 60 * 1000);
      month = nowVn.getUTCMonth() + 1;
    }

    let year;
    if (req.query.year !== undefined && req.query.year !== '') {
      const parsedYear = parseInt(req.query.year, 10);
      if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return sendError(res, 'Năm (year) không hợp lệ. Vui lòng cung cấp năm từ 2000 đến 2100.', null, 400);
      }
      year = parsedYear;
    } else {
      // Mặc định năm hiện tại theo múi giờ Việt Nam (UTC+7)
      const nowVn = new Date(Date.now() + 7 * 60 * 60 * 1000);
      year = nowVn.getUTCFullYear();
    }

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

    // Hỗ trợ phân trang nếu client gửi page/limit
    const options = {};
    if (req.query.page !== undefined || req.query.limit !== undefined) {
      options.page = Math.max(1, parseInt(req.query.page, 10) || 1);
      options.limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    }

    const { generateMonthlyReport } = require('../services/report.service');
    const result = await generateMonthlyReport(month, year, departmentFilter, options);

    return sendSuccess(res, `Lấy báo cáo tổng hợp tháng ${month}/${year} thành công.`, {
      month,
      year,
      totalUsers: result.totalUsers,
      report: result.report,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceReport,
  getMonthlyReport,
};
