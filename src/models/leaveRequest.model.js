const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
      required: false, // Lịch dạy cần xin nghỉ / dạy bù
    },
    requestType: {
      type: String,
      enum: ['LEAVE_OFF', 'MAKEUP_CLASS', 'CHANGE_SHIFT'], // Xin nghỉ, Dạy bù, Đổi ca
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Lý do xin nghỉ/dạy bù là bắt buộc'],
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvalNote: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
