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
const { sendAbsentWarningEmail } = require('./email.service');
const { getVietnamTime, getVietnamDayRange } = require('./attendance.service');

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
    checkInTime: null,
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
      const actorId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

      await AuditLog.create({
        actor: actorId,
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
 * Khởi tạo toàn bộ các cron job chạy nền của hệ thống
 * Thiết lập chạy tự động cùng server Express
 */
const initCronJobs = () => {
  if (!cron) {
    console.warn('[Cron Service] Bỏ qua initCronJobs vì node-cron không khả dụng.');
    return;
  }

  // Lập lịch chạy lúc 23:59:00 mỗi ngày theo giờ Việt Nam
  // Cú pháp cron: Phút (59) Giờ (23) Ngày trong tháng (*) Tháng (*) Ngày trong tuần (*)
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

  console.log('[Cron Service] Đã kích hoạt tiến trình nền kiểm tra vắng mặt tự động (23:59 hàng ngày, Asia/Ho_Chi_Minh).');
};

module.exports = {
  getTodayActiveSchedules,
  runDailyAbsentCheck,
  initCronJobs,
};
