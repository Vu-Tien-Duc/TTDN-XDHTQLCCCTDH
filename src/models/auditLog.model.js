const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorType: {
      type: String,
      enum: ['USER', 'SYSTEM'],
      default: 'USER',
    },
    action: {
      type: String,
      required: [true, 'Hành động thao tác (action) là bắt buộc'],
      trim: true,
    },
    targetId: {
      type: String,
      required: [true, 'ID đối tượng bị tác động (targetId) là bắt buộc'],
    },
    targetType: {
      type: String,
      required: [true, 'Loại đối tượng (targetType) là bắt buộc'],
      trim: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

// Indexes phục vụ lọc & sắp xếp tối ưu
auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Đảm bảo tính bất biến (Immutability / Append-Only) cho Audit Logs
const blockMutation = function () {
  const err = new Error('Nhật ký kiểm toán (Audit Log) là dữ liệu bất biến, không được phép sửa hoặc xóa.');
  err.status = 403;
  throw err;
};

// Chặn toàn bộ thao tác sửa đổi trên Query
auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('replaceOne', blockMutation);
auditLogSchema.pre('findOneAndReplace', blockMutation);

// Chặn toàn bộ thao tác xóa trên Query
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);

// Chặn sửa đổi thông qua document.save() sau khi đã được lưu
auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    blockMutation();
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
