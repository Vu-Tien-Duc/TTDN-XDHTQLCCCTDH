const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người thực hiện thao tác (actor) là bắt buộc'],
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
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
