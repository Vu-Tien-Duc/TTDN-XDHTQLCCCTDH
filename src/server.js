require('dotenv').config();

// Kiểm tra bắt buộc biến môi trường bảo mật JWT (tự động gán mặc định nếu ở môi trường dev)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'university_attendance_secret_key_2026';
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  process.env.REFRESH_TOKEN_SECRET = 'university_attendance_refresh_secret_key_2026';
}

const app = require('./app');
const connectDB = require('./config/db');
const { initCronJobs } = require('./services/cron.service');

const PORT = process.env.PORT || 5000;

// Kết nối CSDL MongoDB và khởi chạy Server
const startServer = async () => {
  try {
    await connectDB();

    // Dọn dẹp dữ liệu: đảm bảo các bản ghi VẮNG MẶT (ABSENT/EXCUSED_ABSENCE) không bị gán giờ check-in giả
    try {
      const AttendanceLog = require('./models/attendanceLog.model');
      await AttendanceLog.updateMany(
        { status: { $in: ['ABSENT', 'EXCUSED_ABSENCE'] }, checkInTime: { $ne: null } },
        { $set: { checkInTime: null } }
      );
    } catch (e) {
      console.warn('[Data Hygiene] Lưu ý kiểm tra dữ liệu chấm công:', e.message);
    }

    // Khởi tạo các tiến trình chạy nền (node-cron)
    initCronJobs();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`===================================================`);
      console.log(`[Server] Máy chủ đang chạy tại: http://localhost:${PORT}`);
      console.log(`[Swagger] Tài liệu API (Swagger UI): http://localhost:${PORT}/api-docs`);
      console.log(`===================================================`);
    });
  } catch (error) {
    console.error('[Server Error] Không thể khởi chạy Server:', error);
    process.exit(1);
  }
};

startServer();
