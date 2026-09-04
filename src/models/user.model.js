const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      required: [true, 'Mã cán bộ/giảng viên là bắt buộc'],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Họ và tên là bắt buộc'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      minlength: 6,
      select: false, // Bỏ qua password khi query trừ khi được gọi rõ ràng
    },
    phone: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['ADMIN', 'LECTURER', 'STAFF', 'MANAGER'],
      default: 'LECTURER',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: false,
    },
    title: {
      type: String,
      default: 'Giảng viên', // Chức danh: Giáo sư, Phó Giáo sư, Tiến sĩ, Thạc sĩ,...
    },
    avatar: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
