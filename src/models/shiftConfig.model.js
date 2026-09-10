const mongoose = require('mongoose');

const shiftConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên ca làm việc là bắt buộc'],
      trim: true,
    },
    startTime: {
      type: String,
      required: [true, 'Giờ bắt đầu ca (HH:mm) là bắt buộc'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ bắt đầu phải là HH:mm'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'Giờ kết thúc ca (HH:mm) là bắt buộc'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ kết thúc phải là HH:mm'],
      trim: true,
    },
    lateThresholdMinutes: {
      type: Number,
      required: [true, 'Ngưỡng phút trễ cho phép là bắt buộc'],
      default: 15,
      min: [0, 'Ngưỡng phút trễ không thể là số âm'],
    },
  },
  {
    timestamps: true,
    collection: 'shift_configs',
  }
);

// Đánh index tối ưu tra cứu cho name và cặp (startTime, endTime) theo yêu cầu Ngày 2
shiftConfigSchema.index({ name: 1 });
shiftConfigSchema.index({ startTime: 1, endTime: 1 });

module.exports = mongoose.model('ShiftConfig', shiftConfigSchema, 'shift_configs');
