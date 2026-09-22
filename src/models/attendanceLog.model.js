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
      enum: ['manual', 'face', 'qr', 'gps', 'fingerprint', 'admin_override', 'system'],
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
    confidenceScore: {
      type: Number,
      default: null, // 0.0 - 1.0, chỉ áp dụng cho method: 'face'
    },
    capturedImage: {
      type: String,
      default: null, // Base64 hoặc URL ảnh chụp chứng cứ
    },
    workDate: {
      type: String,
      default: function () {
        const d = this.checkInTime ? new Date(this.checkInTime) : new Date();
        const vnDate = new Date(d.getTime() + 7 * 3600 * 1000);
        return vnDate.toISOString().slice(0, 10);
      },
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'attendance_logs',
  }
);

// Indexes hỗ trợ tra cứu và ngăn trùng lặp (P1 - Item 9)
attendanceLogSchema.index(
  { userId: 1, scheduleId: 1, workDate: 1 },
  { unique: true, partialFilterExpression: { scheduleId: { $type: 'objectId' }, workDate: { $type: 'string' } } }
);
attendanceLogSchema.index({ userId: 1, checkOutTime: 1, checkInTime: -1 });
attendanceLogSchema.index({ userId: 1, checkInTime: -1 });
attendanceLogSchema.index({ scheduleId: 1, checkInTime: 1 });
attendanceLogSchema.index({ userId: 1, createdAt: -1 });
attendanceLogSchema.index({ leaveRequestId: 1 });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema, 'attendance_logs');

