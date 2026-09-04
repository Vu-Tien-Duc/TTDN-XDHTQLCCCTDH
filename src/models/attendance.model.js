const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
      required: false, // Thời khóa biểu liên quan (nếu là giảng dạy)
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    method: {
      type: String,
      enum: ['QR_CODE', 'GPS_LOCATION', 'WIFI_IP', 'FACE_RECOGNITION', 'MANUAL'],
      default: 'QR_CODE',
    },
    status: {
      type: String,
      enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'VALIDATED'],
      default: 'ON_TIME',
    },
    locationData: {
      latitude: Number,
      longitude: Number,
      address: String,
      wifiIp: String,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
