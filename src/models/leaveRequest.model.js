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
<<<<<<< HEAD
      enum: {
        values: ['nghi_phep', 'day_bu', 'doi_ca'],
        message: 'Loại đơn không hợp lệ',
      },
=======
      enum: ['nghi_phep', 'day_bu', 'doi_ca'],
>>>>>>> b24b7ba958d3ee96263bc17378d92648966d96aa
      required: [true, 'Loại đơn (nghi_phep, day_bu, doi_ca) là bắt buộc'],
    },
    reason: {
      type: String,
      required: [true, 'Lý do xin nghỉ/đổi ca là bắt buộc'],
      trim: true,
<<<<<<< HEAD
      minlength: [5, 'Lý do phải có ít nhất 5 ký tự'],
      maxlength: [500, 'Lý do không được vượt quá 500 ký tự'],
=======
>>>>>>> b24b7ba958d3ee96263bc17378d92648966d96aa
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
<<<<<<< HEAD
      trim: true,
=======
>>>>>>> b24b7ba958d3ee96263bc17378d92648966d96aa
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
<<<<<<< HEAD
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
=======
      default: null,
      validate: {
        validator: function (val) {
          if (this.status === 'REJECTED' && (!val || val.trim() === '')) {
            return false;
          }
>>>>>>> b24b7ba958d3ee96263bc17378d92648966d96aa
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

<<<<<<< HEAD
leaveRequestSchema.index({ userId: 1, status: 1, type: 1 });

leaveRequestSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate('endDate', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
  }
});

=======
// Index bắt buộc tăng tốc pipeline aggregate tính số ngày phép còn lại
leaveRequestSchema.index({ userId: 1, status: 1, type: 1 });

>>>>>>> b24b7ba958d3ee96263bc17378d92648966d96aa
module.exports = mongoose.model('LeaveRequest', leaveRequestSchema, 'leave_requests');
