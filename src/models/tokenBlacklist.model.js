const mongoose = require('mongoose');

/**
 * Schema quản lý danh sách token bị thu hồi (Blacklist) khi người dùng đăng xuất
 * Sử dụng TTL index để MongoDB tự động xóa token sau khi đã hết hạn
 */
const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, 'Chuỗi token là bắt buộc'],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Thời điểm hết hạn là bắt buộc'],
    },
  },
  {
    timestamps: true,
    collection: 'token_blacklists',
  }
);

// TTL index: MongoDB tự động xóa bản ghi khi thời gian hiện tại vượt qua expiresAt
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema, 'token_blacklists');
