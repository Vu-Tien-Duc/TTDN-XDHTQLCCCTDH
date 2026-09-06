const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

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
      const myInfo = await User.findById(req.user.id);
      const facultyUsers = await User.find({ departmentId: myInfo.departmentId }).select('_id');
      const allFacultyIds = facultyUsers.map((u) => u._id.toString());

      if (userId) {
        if (!allFacultyIds.includes(userId)) {
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
      attendanceQuery.checkInTime = {};
      if (from) attendanceQuery.checkInTime.$gte = new Date(from);
      if (to) attendanceQuery.checkInTime.$lte = new Date(to);
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
        const diffDays = Math.ceil((new Date(item.endDate) - new Date(item.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        return sum + Math.max(1, diffDays);
      }, 0),
    };

    return sendSuccess(res, 'Lấy báo cáo thống kê chấm công thành công.', summary);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceReport,
};
