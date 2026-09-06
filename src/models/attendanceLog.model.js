const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người chấm công (userId) là bắt buộc'],
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftConfig',
      required: [true, 'Ca chấm công (shiftId) là bắt buộc'],
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
      default: null,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    method: {
      type: String,
      enum: ['manual', 'face', 'qr', 'gps', 'fingerprint', 'admin_override'],
      required: [true, 'Phương thức chấm công (method) là bắt buộc'],
    },
    isManualOverride: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'EXCUSED_ABSENCE'],
      required: [true, 'Trạng thái chấm công (status) là bắt buộc'],
    },
    leaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveRequest',
      default: null,
    },
    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    deviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'attendance_logs',
  }
);

// Indexes hỗ trợ tra cứu lịch sử chấm công theo người dùng và ngày
attendanceLogSchema.index({ userId: 1, createdAt: -1 });
attendanceLogSchema.index({ userId: 1, checkInTime: 1 });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema, 'attendance_logs');
