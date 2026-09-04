const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã phòng ban/khoa là bắt buộc'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Tên phòng ban/khoa là bắt buộc'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['FACULTY', 'DEPARTMENT', 'ADMIN_OFFICE'],
      default: 'FACULTY', // Khoa, Bộ môn, Phòng chức năng
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

module.exports = mongoose.model('Department', departmentSchema);
