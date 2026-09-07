const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, 'Chuỗi token là bắt buộc'],
      unique: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Chủ sở hữu token (userId) là bắt buộc'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Thời điểm hết hạn (expiresAt) là bắt buộc'],
    },
  },
  {
    timestamps: true,
    collection: 'refresh_tokens',
  }
);

// TTL index: MongoDB tự động xóa document khi thời gian hiện tại vượt qua expiresAt
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema, 'refresh_tokens');
