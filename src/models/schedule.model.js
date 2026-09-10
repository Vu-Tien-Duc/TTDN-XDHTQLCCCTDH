const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người được phân lịch (userId) là bắt buộc'],
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftConfig',
      required: [true, 'Ca áp dụng (shiftId) là bắt buộc'],
    },
    startTime: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ bắt đầu phải là HH:mm'],
      default: '',
    },
    endTime: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ kết thúc phải là HH:mm'],
      default: '',
    },
    roomId: {
      type: String,
      trim: true,
      default: '',
    },
    weekday: {
      type: Number,
      required: [true, 'Thứ trong tuần (0-6) là bắt buộc'],
      min: [0, 'Thứ trong tuần từ 0 (Chủ nhật) đến 6 (Thứ bảy)'],
      max: [6, 'Thứ trong tuần từ 0 (Chủ nhật) đến 6 (Thứ bảy)'],
    },
    isRecurring: {
      type: Boolean,
      required: [true, 'Trạng thái lặp (isRecurring) là bắt buộc'],
      default: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Ngày bắt đầu hiệu lực (startDate) là bắt buộc'],
    },
    endDate: {
      type: Date,
      required: [true, 'Ngày kết thúc hiệu lực (endDate) là bắt buộc'],
    },
  },
  {
    timestamps: true,
    collection: 'schedules',
  }
);

// Hook pre('save'): Tự động kế thừa startTime/endTime từ ShiftConfig nếu người tạo không chỉ định riêng
scheduleSchema.pre('save', async function () {
  if ((!this.startTime || !this.endTime) && this.shiftId) {
    try {
      const ShiftConfig = mongoose.model('ShiftConfig');
      const shift = await ShiftConfig.findById(this.shiftId);
      if (shift) {
        if (!this.startTime) this.startTime = shift.startTime;
        if (!this.endTime) this.endTime = shift.endTime;
      }
    } catch (err) {
      // Bỏ qua lỗi truy vấn phụ để controller xử lý validation ca
    }
  }
});

// Index bắt buộc tăng tốc truy vấn "lịch hiệu lực hôm nay" gọi liên tục ở check-in và cron
scheduleSchema.index({ userId: 1, weekday: 1, startDate: 1, endDate: 1 });
scheduleSchema.index({ shiftId: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema, 'schedules');
