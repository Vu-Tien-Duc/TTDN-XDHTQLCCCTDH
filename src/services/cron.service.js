let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('[Cron Service] Thư viện node-cron chưa được tải:', err.message);
}

const Schedule = require('../models/schedule.model');
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
 * Tiến trình kiểm tra vắng mặt hàng ngày (quét vào cuối ngày 23:59)
 * Sẽ được mở rộng ở Ngày 2, 3, 4 để đối chiếu chấm công, đơn xin nghỉ và gửi email cảnh báo
 * 
 * @param {Date} [targetDate=new Date()]
 */
const runDailyAbsentCheck = async (targetDate = new Date()) => {
  console.log('------------------------------------------------------------');
  console.log('[Cron Service] Bắt đầu tiến trình tự động quét điểm danh cuối ngày...');
  try {
    const activeSchedules = await getTodayActiveSchedules(targetDate);
    console.log(`[Cron Service] Tổng số lịch cần rà soát điểm danh: ${activeSchedules.length}`);
    // Các bước tiếp theo:
    // Ngày 2: Đối chiếu attendance_logs và leave_requests
    // Ngày 3: Tự động tạo bản ghi ABSENT
    // Ngày 4: Gửi email cảnh báo vắng mặt
  } catch (error) {
    console.error('[Cron Service] Lỗi trong tiến trình quét điểm danh:', error);
  }
  console.log('[Cron Service] Kết thúc tiến trình quét điểm danh.');
  console.log('------------------------------------------------------------');
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
