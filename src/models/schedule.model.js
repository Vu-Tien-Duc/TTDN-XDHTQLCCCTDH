const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    lecturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Giảng viên là bắt buộc'],
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    room: {
      type: String,
      required: true, // Ví dụ: A2-301
      trim: true,
    },
    date: {
      type: Date,
      required: true, // Ngày giảng dạy / công tác
    },
    shift: {
      type: String,
      enum: ['MORNING', 'AFTERNOON', 'EVENING', 'SHIFT_1', 'SHIFT_2', 'SHIFT_3', 'SHIFT_4'],
      required: true,
    },
    startTime: {
      type: String, // Định dạng "HH:mm" ví dụ: "07:00"
      required: true,
    },
    endTime: {
      type: String, // Định dạng "HH:mm" ví dụ: "11:30"
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'CANCELLED', 'COMPLETED', 'SUBSTITUTED'],
      default: 'SCHEDULED',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Schedule', scheduleSchema);
