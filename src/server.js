require('dotenv').config();

// Kiểm tra bắt buộc biến môi trường bảo mật JWT
const requiredSecurityEnv = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET'];
const missingSecurityEnv = requiredSecurityEnv.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missingSecurityEnv.length > 0) {
  console.error('================================================================');
  console.error('[SECURITY CRITICAL] LỖI CẤU HÌNH BẢO MẬT: THIẾU BIẾN MÔI TRƯỜNG BẮT BUỘC!');
  missingSecurityEnv.forEach((key) => console.error(` - Thiếu: ${key}`));
  console.error('Máy chủ bị từ chối khởi động nhằm ngăn chặn nguy cơ giả mạo Token.');
  console.error('Vui lòng khai báo đầy đủ JWT_SECRET và REFRESH_TOKEN_SECRET trong file .env');
  console.error('================================================================');
  process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');
const { initCronJobs } = require('./services/cron.service');

const PORT = process.env.PORT || 5000;

// Kết nối CSDL MongoDB và khởi chạy Server
const startServer = async () => {
  try {
    await connectDB();

    // Khởi tạo các tiến trình chạy nền (node-cron)
    initCronJobs();

    app.listen(PORT, () => {
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
