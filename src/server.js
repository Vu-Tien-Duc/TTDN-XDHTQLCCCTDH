require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 27017;

// Kết nối CSDL MongoDB và khởi chạy Server
const startServer = async () => {
  try {
    await connectDB();

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
