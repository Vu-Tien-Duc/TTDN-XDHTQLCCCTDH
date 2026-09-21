let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('[Cron Service] Thư viện node-cron chưa được tải:', err.message);
}

const mongoose = require('mongoose');
const Schedule = require('../models/schedule.model');
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const AuditLog = require('../models/auditLog.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const ShiftConfig = require('../models/shiftConfig.model');
const { sendAbsentWarningEmail, sendDailyAttendanceSummaryEmail } = require('./email.service');
const { getVietnamTime, getVietnamDayRange, timeStringToMinutes } = require('./attendance.service');

/**
 * Kiểm tra xem email có thể gửi thư thực tế qua Internet không (tránh gửi vào domain mẫu sinh viên/giảng viên ảo làm bounce thư)
 */
const isDeliverableEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  if (lower.endsWith('@university.edu.vn') || lower.endsWith('@example.com')) return false;
  return lower.includes('@') && lower.includes('.');
};

/**
 * Lấy toàn bộ lịch phân công giảng dạy có hiệu lực trong ngày
 * Quy đổi về múi giờ chuẩn Asia/Ho_Chi_Minh (UTC+7)
 * 
 * @param {Date} [targetDate=new Date()] Mốc thời gian cần kiểm tra (mặc định là thời điểm hiện tại)
 * @returns {Promise<Array>} Danh sách các lịch dạy hợp lệ đã populate userId và shiftId
 */
const getTodayActiveSchedules = async (targetDate = new Date()) => {
  try {
    // 1. Quy đổi thời điểm hiện tại về múi giờ Asia/Ho_Chi_Minh
    const vnTime = getVietnamTime(targetDate);
    const currentWeekday = vnTime.getDay(); // 0: Chủ nhật, 1: Thứ hai, ..., 6: Thứ bảy

    // 2. Xác định mốc đầu ngày (00:00:00.000) và cuối ngày (23:59:59.999) chuẩn UTC+7
    const { startOfDay, endOfDay, dateStr } = getVietnamDayRange(targetDate);

    console.log(`[Cron Service] Lọc lịch dạy ngày: ${dateStr} (Thứ ${currentWeekday === 0 ? 'CN' : currentWeekday + 1}, weekday: ${currentWeekday})`);

    // 3. Truy vấn CSDL tìm các bản ghi thỏa mãn:
    // - weekday trùng với hôm nay
    // - startDate <= endOfDay và endDate >= startOfDay (lịch nằm trong khoảng hiệu lực)
    const schedules = await Schedule.find({
      weekday: currentWeekday,
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    })
      .populate('userId', 'fullName email role departmentId')
      .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
      .sort({ startTime: 1 });

    console.log(`[Cron Service] Tìm thấy ${schedules.length} lịch giảng dạy hiệu lực trong ngày ${dateStr}.`);
    return schedules;
  } catch (error) {
    console.error('[Cron Service] Lỗi khi truy vấn getTodayActiveSchedules:', error);
    throw error;
  }
};

/**
 * Xử lý đối chiếu điểm danh và tạo bản ghi vắng mặt (ABSENT) cho một ca dạy
 * Đảm bảo tính Idempotent tuyệt đối (chống trùng lặp khi chạy lại cron hoặc restart server)
 * 
 * @param {Object} schedule Bản ghi lịch dạy (đã populate userId và shiftId)
 * @param {{ startOfDay: Date, endOfDay: Date, dateStr: string }} dayRange Khoảng thời gian trong ngày
 * @returns {Promise<Object>} Kết quả xử lý { scheduleId, userId, action: 'SKIPPED' | 'CREATED', status, reason }
 */
const processScheduleAttendanceCheck = async (schedule, dayRange) => {
  const { startOfDay, endOfDay } = dayRange;
  const userId = schedule.userId?._id || schedule.userId;
  const shiftId = schedule.shiftId?._id || schedule.shiftId;
  const teacherName = schedule.userId?.fullName || userId;
  const shiftName = schedule.shiftId?.name || shiftId;

  // 1. Kiểm tra đối chiếu xem giảng viên đã có bản ghi chấm công nào hôm nay cho ca/lịch này chưa
  // Tính cả checkInTime hoặc createdAt nằm trong khoảng [00:00:00, 23:59:59] của ngày hôm nay
  const existingLog = await AttendanceLog.findOne({
    userId,
    scheduleId: schedule._id,
    $or: [
      { checkInTime: { $gte: startOfDay, $lte: endOfDay } },
      { createdAt: { $gte: startOfDay, $lte: endOfDay } },
    ],
  });

  // Trường hợp bỏ qua: Nếu đã có log (dù là ON_TIME, LATE, EARLY_LEAVE, EXCUSED_ABSENCE, hoặc ABSENT đã tạo trước đó) -> Không can thiệp
  if (existingLog) {
    console.log(`[Cron Service] [BỎ QUA] Giảng viên ${teacherName} (${shiftName}): Đã có bản ghi chấm công với trạng thái '${existingLog.status}' (Log ID: ${existingLog._id}).`);
    return {
      scheduleId: schedule._id,
      userId,
      teacherName,
      shiftName,
      action: 'SKIPPED',
      status: existingLog.status,
      logId: existingLog._id,
      reason: `Đã có bản ghi chấm công với trạng thái ${existingLog.status}`,
    };
  }

  // 2. Kiểm tra xem giảng viên có đơn xin nghỉ phép đã được phê duyệt (APPROVED) trong ngày hôm nay không
  const approvedLeave = await LeaveRequest.findOne({
    userId,
    status: 'APPROVED',
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  });

  const finalStatus = approvedLeave ? 'EXCUSED_ABSENCE' : 'ABSENT';
  const leaveRequestId = approvedLeave ? approvedLeave._id : null;

  // 3. Cơ chế Idempotent (Chống trùng lặp tuyệt đối):
  // Tạo bản ghi trong attendance_logs với status: 'ABSENT' (hoặc 'EXCUSED_ABSENCE' nếu có phép),
  // method: 'manual', checkInTime: null, checkOutTime: null
  const newLog = await AttendanceLog.create({
    userId,
    shiftId,
    scheduleId: schedule._id,
    status: finalStatus,
    method: 'manual',
    checkInTime: null, // Vắng mặt hoặc nghỉ phép thì không có giờ check-in
    checkOutTime: null,
    leaveRequestId,
    isManualOverride: false,
    createdAt: endOfDay,
  });

  console.log(`[Cron Service] [ĐÁNH VẮNG] Tự động ghi nhận '${finalStatus}' cho Giảng viên ${teacherName} (${shiftName}) - Log ID: ${newLog._id}`);

  // 4. Gửi email cảnh báo vắng mặt không phép (#21)
  // Đặt khối try/catch bọc gửi mail: Đảm bảo nếu mạng chập chờn hoặc lỗi gửi mail thì không làm gián đoạn tiến trình
  let emailSent = false;
  if (finalStatus === 'ABSENT' && schedule.userId?.email) {
    if (isDeliverableEmail(schedule.userId.email)) {
      try {
        await sendAbsentWarningEmail({
          to: schedule.userId.email,
          fullName: teacherName,
          shiftName: shiftName,
          date: dayRange.dateStr,
        });
        emailSent = true;
        console.log(`[Cron Service] [GỬI MAIL] Đã gửi email cảnh báo vắng mặt thành công tới: ${schedule.userId.email}`);
      } catch (emailErr) {
        console.error(`[Cron Service] [LỖI GỬI MAIL] Không thể gửi mail cảnh báo tới ${schedule.userId.email}:`, emailErr.message);
      }
    } else {
      console.log(`[Cron Service] Bỏ qua gửi email ra Internet tới địa chỉ giả định của mẫu: ${schedule.userId.email}`);
      emailSent = false;
    }
  }

  return {
    scheduleId: schedule._id,
    userId,
    teacherName,
    shiftName,
    action: 'CREATED',
    status: finalStatus,
    logId: newLog._id,
    leaveRequestId,
    emailSent,
    reason: approvedLeave
      ? 'Đã có đơn nghỉ phép được duyệt hợp lệ (EXCUSED_ABSENCE)'
      : 'Không phát sinh lượt check-in nào trong ngày (ABSENT)',
  };
};

/**
 * Tiến trình kiểm tra vắng mặt hàng ngày (quét tự động vào cuối ngày 23:59)
 * 
 * @param {Date} [targetDate=new Date()]
 * @returns {Promise<Object>} Tổng kết kết quả quét vắng mặt
 */
const runDailyAbsentCheck = async (targetDate = new Date()) => {
  console.log('------------------------------------------------------------');
  console.log('[Cron Service] Bắt đầu tiến trình tự động quét điểm danh cuối ngày...');
  try {
    const dayRange = getVietnamDayRange(targetDate);
    const activeSchedules = await getTodayActiveSchedules(targetDate);
    console.log(`[Cron Service] Tổng số lịch cần rà soát điểm danh: ${activeSchedules.length}`);

    const results = [];
    let skippedCount = 0;
    let absentCreatedCount = 0;
    let excusedCreatedCount = 0;

    for (const schedule of activeSchedules) {
      try {
        const itemResult = await processScheduleAttendanceCheck(schedule, dayRange);
        results.push(itemResult);
        if (itemResult.action === 'SKIPPED') {
          skippedCount++;
        } else if (itemResult.action === 'CREATED') {
          if (itemResult.status === 'ABSENT') absentCreatedCount++;
          else if (itemResult.status === 'EXCUSED_ABSENCE') excusedCreatedCount++;
        }
      } catch (err) {
        console.error(`[Cron Service] Lỗi xử lý lịch ${schedule._id}:`, err);
        results.push({
          scheduleId: schedule._id,
          action: 'ERROR',
          error: err.message,
        });
      }
    }

    const summary = {
      checkedDate: dayRange.dateStr,
      totalSchedules: activeSchedules.length,
      absentCreatedCount,
      excusedCreatedCount,
      skippedCount,
      details: results,
    };

    // 5. Ghi nhận tự động vào Collection audit_logs (#21)
    try {
      const adminUser = await User.findOne({ role: 'admin' });
      const actorId = adminUser ? adminUser._id : null;

      await AuditLog.create({
        actor: actorId,
        actorType: 'SYSTEM',
        action: 'CRON_AUTO_ABSENT',
        targetId: `CRON_${dayRange.dateStr}`,
        targetType: 'AttendanceLog',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
        details: {
          scannedDate: dayRange.dateStr,
          totalSchedules: activeSchedules.length,
          presentCount: skippedCount, // số người đi làm / đã có log
          excusedCount: excusedCreatedCount, // số người nghỉ có phép
          absentCount: absentCreatedCount, // số người bị đánh vắng
          results: results.map((r) => ({
            scheduleId: r.scheduleId,
            userId: r.userId,
            teacherName: r.teacherName,
            action: r.action,
            status: r.status,
            emailSent: r.emailSent || false,
          })),
        },
      });
      console.log(`[Cron Service] [AUDIT LOG] Đã ghi nhận vết thao tác tự động CRON_AUTO_ABSENT vào CSDL.`);
    } catch (auditErr) {
      console.error(`[Cron Service] [LỖI AUDIT LOG] Không thể ghi audit log:`, auditErr.message);
    }

    // 6. Tổng hợp chi tiết và tự động gửi Email Báo Cáo Cuối Ngày tới Ban Giám Hiệu & Quản Trị Viên
    try {
      const todayLogs = await AttendanceLog.find({
        $or: [
          { checkInTime: { $gte: dayRange.startOfDay, $lte: dayRange.endOfDay } },
          { createdAt: { $gte: dayRange.startOfDay, $lte: dayRange.endOfDay } },
        ],
      })
        .populate({
          path: 'userId',
          select: 'fullName email departmentId role',
          populate: { path: 'departmentId', select: 'name' },
        })
        .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
        .populate('scheduleId', 'roomId weekday subjectName');

      const onTimeList = [];
      const lateList = [];
      const earlyList = [];
      const absentList = [];
      const excusedList = [];

      for (const log of todayLogs) {
        const u = log.userId || {};
        const shift = log.shiftId || {};
        const sched = log.scheduleId || {};

        const checkInTimeStr = log.checkInTime 
          ? new Date(log.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--';
        const checkOutTimeStr = log.checkOutTime 
          ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) 
          : 'Chưa về';

        const item = {
          fullName: u.fullName || 'Nhân sự',
          departmentName: u.departmentId?.name || '',
          shiftName: shift.name || 'Ca làm việc',
          roomId: sched.roomId || '',
          checkInTimeStr,
          checkOutTimeStr,
          method: log.method === 'face' ? 'Face ID' : (log.method === 'qr' ? 'QR Code' : 'Thủ công'),
          emailSent: true,
        };

        if (log.status === 'ON_TIME') {
          onTimeList.push(item);
        } else if (log.status === 'LATE') {
          let lateMins = 0;
          if (log.checkInTime && shift.startTime) {
            const vnDate = getVietnamTime(log.checkInTime);
            const currentMins = vnDate.getHours() * 60 + vnDate.getMinutes();
            const startMins = timeStringToMinutes(shift.startTime);
            lateMins = Math.max(0, currentMins - startMins);
          }
          const lateHours = Math.floor(lateMins / 60);
          const remMins = lateMins % 60;
          item.lateMinutes = lateMins;
          item.lateTimeFormatted = lateHours > 0 ? `${lateHours}h ${remMins}p` : `${lateMins} phút`;
          lateList.push(item);
        } else if (log.status === 'EARLY_LEAVE') {
          let earlyMins = 0;
          if (log.checkOutTime && shift.endTime) {
            const vnDate = getVietnamTime(log.checkOutTime);
            const checkOutMins = vnDate.getHours() * 60 + vnDate.getMinutes();
            const endMins = timeStringToMinutes(shift.endTime);
            earlyMins = Math.max(0, endMins - checkOutMins);
          }
          const earlyHours = Math.floor(earlyMins / 60);
          const remMins = earlyMins % 60;
          item.earlyMinutes = earlyMins;
          item.earlyTimeFormatted = earlyHours > 0 ? `${earlyHours}h ${remMins}p` : `${earlyMins} phút`;
          earlyList.push(item);
        } else if (log.status === 'ABSENT') {
          absentList.push(item);
        } else if (log.status === 'EXCUSED_ABSENCE') {
          excusedList.push(item);
        }
      }

      // Lấy danh sách email Admin cần nhận báo cáo (chỉ gửi địa chỉ email thật, tránh gửi vào domain ảo @university.edu.vn)
      const adminUsers = await User.find({ role: 'admin', isActive: true });
      const recipientEmails = new Set();
      adminUsers.forEach((a) => {
        if (isDeliverableEmail(a.email)) recipientEmails.add(a.email.trim());
      });
      if (isDeliverableEmail(process.env.EMAIL_USER)) recipientEmails.add(process.env.EMAIL_USER.trim());

      for (const email of recipientEmails) {
        await sendDailyAttendanceSummaryEmail({
          to: email,
          dateStr: dayRange.dateStr,
          totalSchedules: activeSchedules.length,
          stats: {
            onTimeCount: onTimeList.length,
            lateCount: lateList.length,
            earlyCount: earlyList.length,
            excusedCount: excusedList.length,
            absentCount: absentList.length,
          },
          absentList,
          lateList,
          earlyList,
          excusedList,
          presentList: onTimeList,
        }).catch((err) => console.error(`[Cron Service] Lỗi gửi báo cáo ngày tới ${email}:`, err.message));
      }
      console.log(`[Cron Service] [BÁO CÁO CUỐI NGÀY] Đã gửi email tổng kết chấm công tới ${recipientEmails.size} quản trị viên.`);
    } catch (reportErr) {
      console.error('[Cron Service] Lỗi khi tạo báo cáo email cuối ngày:', reportErr.message);
    }

    console.log(`[Cron Service] Kết thúc quét điểm danh: Tổng ${activeSchedules.length} lịch | Đánh vắng ABSENT: ${absentCreatedCount} | Nghỉ phép EXCUSED: ${excusedCreatedCount} | Bỏ qua (Đã có log): ${skippedCount}`);
    console.log('------------------------------------------------------------');
    return summary;
  } catch (error) {
    console.error('[Cron Service] Lỗi trong tiến trình quét điểm danh:', error);
    console.log('------------------------------------------------------------');
    throw error;
  }
};

/**
 * Quét định kỳ trong ngày (mỗi 5 phút):
 * Tự động tìm các ca làm việc mà giảng viên chưa check-in và đã quá ngưỡng đi muộn (startMinutes + lateThresholdMinutes)
 * để tự động hủy lịch và ghi nhận vắng mặt (ABSENT) ngay trong ngày!
 */
const scanAndMarkExpiredShiftsAbsent = async (targetDate = new Date()) => {
  try {
    const vnTime = getVietnamTime(targetDate);
    const currentMinutes = vnTime.getHours() * 60 + vnTime.getMinutes();
    const dayRange = getVietnamDayRange(targetDate);
    const activeSchedules = await getTodayActiveSchedules(targetDate);

    for (const schedule of activeSchedules) {
      const shift = schedule.shiftId;
      if (!shift || !shift.startTime) continue;

      const shiftStartStr = schedule.startTime || shift.startTime;
      const startMinutes = timeStringToMinutes(shiftStartStr);
      const lateThreshold = shift.lateThresholdMinutes !== undefined ? shift.lateThresholdMinutes : 15;

      // Nếu thời điểm hiện tại đã vượt quá giờ bắt đầu ca + ngưỡng cho phép đi muộn
      if (currentMinutes > startMinutes + lateThreshold) {
        await processScheduleAttendanceCheck(schedule, dayRange);
      }
    }
  } catch (error) {
    console.error('[Cron Service] Lỗi trong scanAndMarkExpiredShiftsAbsent:', error.message);
  }
};

/**
 * Khởi tạo toàn bộ các cron job chạy nền của hệ thống
 * Thiết lập chạy tự động cùng server Express
 */
const initCronJobs = () => {
  if (!cron) {
    console.warn('[Cron Service] Bỏ qua initCronJobs vì node-cron không khả dụng.');
    return;
  }

  // 1. Quét vắng mặt tự động mỗi 5 phút trong ngày theo giờ Việt Nam
  // Tự động đánh vắng / hủy lịch ngay khi giảng viên đi muộn vượt quá ngưỡng của ca đó
  const periodicAbsentCronExpression = '*/5 * * * *';
  cron.schedule(
    periodicAbsentCronExpression,
    async () => {
      await scanAndMarkExpiredShiftsAbsent();
    },
    {
      scheduled: true,
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );

  // 2. Lập lịch chạy lúc 23:59:00 mỗi ngày theo giờ Việt Nam để chốt danh sách & gửi mail tổng hợp
  const dailyAbsentCronExpression = '59 23 * * *';
  cron.schedule(
    dailyAbsentCronExpression,
    async () => {
      console.log(`[Cron Job] Kích hoạt tác vụ quét vắng mặt tự động lúc 23:59 (${new Date().toISOString()})`);
      await runDailyAbsentCheck();
    },
    {
      scheduled: true,
      timezone: 'Asia/Ho_Chi_Minh',
    }
  );

  console.log('[Cron Service] Đã kích hoạt tiến trình nền kiểm tra vắng mặt tự động (quét mỗi 5 phút & chốt 23:59 hàng ngày, Asia/Ho_Chi_Minh).');
};

module.exports = {
  getTodayActiveSchedules,
  runDailyAbsentCheck,
  scanAndMarkExpiredShiftsAbsent,
  processScheduleAttendanceCheck,
  isDeliverableEmail,
  initCronJobs,
};

