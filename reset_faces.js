require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');

async function resetAllFaces() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
  await mongoose.connect(uri);
  console.log(`[Database] Đã kết nối: ${uri}`);

  const res = await User.updateMany(
    {},
    { $unset: { faceDescriptor: 1 } }
  );

  console.log(`✔ Đã xóa toàn bộ dữ liệu khuôn mặt giả trong CSDL! (${res.modifiedCount} người dùng đã được làm sạch)`);
  console.log('✔ Toàn bộ hệ thống hiện tại 100% chỉ nhận dữ liệu khuôn mặt thật qua Webcam/Ảnh chụp.');
  process.exit(0);
}

resetAllFaces().catch((err) => {
  console.error(err);
  process.exit(1);
});
