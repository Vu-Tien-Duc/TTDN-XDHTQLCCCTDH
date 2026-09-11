const mongoose = require('mongoose');

/**
 * Kết nối đến cơ sở dữ liệu MongoDB thông qua Mongoose
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
    const conn = await mongoose.connect(mongoURI, {
      // Các tùy chọn Mongoose mặc định phù hợp cho phiên bản 6+
    });

    console.log(`[Database] Kết nối MongoDB thành công: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1); // Thoát tiến trình nếu kết nối thất bại
  }
};

module.exports = connectDB;
