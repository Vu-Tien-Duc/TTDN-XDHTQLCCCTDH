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
      enum: ['nghi_phep', 'day_bu', 'doi_ca'],
      required: [true, 'Loại đơn (nghi_phep, day_bu, doi_ca) là bắt buộc'],
    },
    reason: {
      type: String,
      required: [true, 'Lý do xin nghỉ/đổi ca là bắt buộc'],
      trim: true,
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
    rejectionReason: {
      type: String,
      default: null,
      validate: {
        validator: function (val) {
          if (this.status === 'REJECTED' && (!val || val.trim() === '')) {
            return false;
          }
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

// Index bắt buộc tăng tốc pipeline aggregate tính số ngày phép còn lại
leaveRequestSchema.index({ userId: 1, status: 1, type: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema, 'leave_requests');
