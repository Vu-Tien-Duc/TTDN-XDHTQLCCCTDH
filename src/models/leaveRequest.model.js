const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người gửi đơn (userId) là bắt buộc'],
    },
    type: {
      type: String,
      enum: {
        values: ['nghi_phep', 'day_bu', 'doi_ca'],
        message: 'Loại đơn không hợp lệ',
      },
      required: [true, 'Loại đơn (nghi_phep, day_bu, doi_ca) là bắt buộc'],
    },
    reason: {
      type: String,
      required: [true, 'Lý do xin nghỉ/đổi ca là bắt buộc'],
      trim: true,
      minlength: [5, 'Lý do phải có ít nhất 5 ký tự'],
      maxlength: [500, 'Lý do không được vượt quá 500 ký tự'],
    },
    startDate: {
      type: Date,
      required: [true, 'Ngày bắt đầu áp dụng (startDate) là bắt buộc'],
    },
    endDate: {
      type: Date,
      required: [true, 'Ngày kết thúc áp dụng (endDate) là bắt buộc'],
    },
    attachmentUrl: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvalNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Ghi chú duyệt không được vượt quá 500 ký tự'],
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Lý do từ chối không được vượt quá 500 ký tự'],
      validate: {
        validator: function (val) {
          if (this.status === 'REJECTED' && (!val || !val.trim())) return false;
          return true;
        },
        message: 'Lý do từ chối là bắt buộc khi đơn bị từ chối (REJECTED)',
      },
    },
  },
  {
    timestamps: true,
    collection: 'leave_requests',
  }
);

leaveRequestSchema.index({ userId: 1, status: 1, type: 1 });

leaveRequestSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate('endDate', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
  }
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema, 'leave_requests');
