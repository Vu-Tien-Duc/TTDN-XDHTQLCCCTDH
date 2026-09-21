const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const Schedule = require('../models/schedule.model');
const User = require('../models/user.model');
const { sendSuccess } = require('../utils/responseHandler');
const { getDeanScopedUserIds } = require('../utils/deanScope');

/**
 * Helper định dạng ngày/giờ theo định dạng Việt Nam
 */
const formatDateTimeVN = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTimeVN = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateVN = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * @desc Lấy danh sách thông báo thực tế của người dùng hiện tại
 * @route GET /api/notifications
 * @access Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return sendSuccess(res, 'Lấy danh sách thông báo thành công.', []);
    }

    const notifications = [];

    // 1. Thông báo chấm công thực tế gần nhất của người dùng
    const recentAttendances = await AttendanceLog.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate('shiftId', 'name startTime endTime')
      .lean();

    recentAttendances.forEach((att) => {
      const shiftName = att.shiftId?.name || 'Ca làm việc';
      if (att.checkOutTime) {
        notifications.push({
          id: `att-out-${att._id}`,
          title: `Đã check-out: ${shiftName}`,
          message: `Check-out thành công lúc ${formatTimeVN(att.checkOutTime)}. Email biên nhận điểm danh đã gửi về ${user.email}.`,
          type: 'attendance',
          status: 'success',
          timestamp: att.checkOutTime,
          link: '/attendance/history',
        });
      } else if (att.checkInTime) {
        const isLate = att.status === 'LATE';
        notifications.push({
          id: `att-in-${att._id}`,
          title: `Điểm danh thành công (${isLate ? 'Đến muộn' : 'Đúng giờ'}): ${shiftName}`,
          message: `Ghi nhận check-in lúc ${formatTimeVN(att.checkInTime)} (Phương thức: ${att.method?.toUpperCase()}). Đã đồng bộ vào hệ thống & gửi email.`,
          type: 'attendance',
          status: isLate ? 'warning' : 'success',
          timestamp: att.checkInTime,
          link: '/attendance/history',
        });
      } else if (att.status === 'ABSENT') {
        notifications.push({
          id: `att-absent-${att._id}`,
          title: `Cảnh báo vắng mặt: ${shiftName}`,
          message: `Hệ thống ghi nhận vắng mặt ngày ${formatDateVN(att.createdAt)}. Thông báo cảnh báo đã được gửi về email cá nhân.`,
          type: 'attendance',
          status: 'danger',
          timestamp: att.createdAt,
          link: '/leave/create',
        });
      }
    });

    // 2. Thông báo đơn xin nghỉ phép thực tế
    if (user.role === 'giangvien' || user.role === 'nhanvien') {
      const myLeaveRequests = await LeaveRequest.find({ userId: user._id })
        .sort({ updatedAt: -1 })
        .limit(3)
        .lean();

      myLeaveRequests.forEach((leave) => {
        if (leave.status === 'APPROVED') {
          notifications.push({
            id: `leave-${leave._id}`,
            title: 'Đơn xin nghỉ phép đã được duyệt',
            message: `Đơn nghỉ từ ${formatDateVN(leave.startDate)} đến ${formatDateVN(leave.endDate)} đã được phê duyệt. Thông báo xác nhận đã gửi về email.`,
            type: 'leave',
            status: 'success',
            timestamp: leave.updatedAt || leave.createdAt,
            link: '/leave/my-requests',
          });
        } else if (leave.status === 'REJECTED') {
          notifications.push({
            id: `leave-${leave._id}`,
            title: 'Đơn xin nghỉ phép bị từ chối',
            message: `Đơn nghỉ từ ${formatDateVN(leave.startDate)} bị từ chối${leave.rejectionReason ? `: "${leave.rejectionReason}"` : ''}.`,
            type: 'leave',
            status: 'danger',
            timestamp: leave.updatedAt || leave.createdAt,
            link: '/leave/my-requests',
          });
        } else if (leave.status === 'PENDING') {
          notifications.push({
            id: `leave-${leave._id}`,
            title: 'Đơn xin nghỉ phép đang chờ duyệt',
            message: `Đơn xin nghỉ gửi lúc ${formatDateTimeVN(leave.createdAt)} đang chờ Trưởng khoa xem xét và duyệt.`,
            type: 'leave',
            status: 'info',
            timestamp: leave.createdAt,
            link: '/leave/my-requests',
          });
        }
      });
    } else if (user.role === 'truongkhoa' || user.role === 'admin') {
      // Đối với Trưởng khoa hoặc Admin: Đơn nghỉ đang chờ duyệt trong khoa
      let pendingQuery = { status: 'PENDING' };
      if (user.role === 'truongkhoa') {
        const facultyUserIds = await getDeanScopedUserIds(user);
        pendingQuery.userId = { $in: facultyUserIds };
      }
      const pendingLeaves = await LeaveRequest.find(pendingQuery)
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('userId', 'fullName email')
        .lean();

      if (pendingLeaves.length > 0) {
        notifications.push({
          id: `leave-pending-summary`,
          title: `Hộp duyệt đơn: ${pendingLeaves.length} đơn cần xử lý`,
          message: `Có đơn xin nghỉ phép từ ${pendingLeaves.map((l) => l.userId?.fullName || 'cán bộ').join(', ')} đang chờ phê duyệt.`,
          type: 'leave',
          status: 'warning',
          timestamp: pendingLeaves[0].createdAt,
          link: '/leave/approvals',
        });
      }
    }

    // 3. Thông báo lịch dạy hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySchedules = await Schedule.find({
      teacherId: user._id,
      date: { $gte: today, $lt: tomorrow },
    })
      .populate('shiftId', 'name startTime endTime')
      .lean();

    if (todaySchedules.length > 0) {
      notifications.push({
        id: `schedule-today`,
        title: `Lịch công tác hôm nay (${todaySchedules.length} ca)`,
        message: `Hôm nay bạn có lịch tại phòng ${todaySchedules.map((s) => s.room).join(', ')}. Vui lòng chấm công đúng khung giờ ca dạy.`,
        type: 'schedule',
        status: 'info',
        timestamp: today,
        link: '/schedules',
      });
    }

    // 4. Thông báo tự động từ Báo cáo tổng kết Email cuối ngày
    notifications.push({
      id: `report-summary-daily`,
      title: 'Báo cáo tổng kết chấm công tự động',
      message: `Hệ thống tiến trình nền tự động gửi báo cáo công tác & chuyên cần lúc 23:59 hàng ngày đến hòm thư: ${user.email}.`,
      type: 'report',
      status: 'info',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000), // Mốc 2 giờ trước
      link: '/reports',
    });

    // Sắp xếp các thông báo theo thứ tự thời gian mới nhất lên đầu
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return sendSuccess(res, 'Lấy danh sách thông báo thành công.', {
      total: notifications.length,
      unreadCount: Math.min(notifications.length, 3),
      notifications: notifications.slice(0, 8),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
};
