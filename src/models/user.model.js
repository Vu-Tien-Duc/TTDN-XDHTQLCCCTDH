const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Họ tên hiển thị là bắt buộc'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      select: false, // Không bao giờ trả về trong response mặc định
    },
    role: {
      type: String,
      enum: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
      required: [true, 'Vai trò người dùng là bắt buộc'],
      default: 'giangvien',
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Khoa/phòng ban trực thuộc là bắt buộc'],
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    otpCode: {
      type: String,
      default: null,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    otpType: {
      type: String,
      enum: ['VERIFY_ACCOUNT', 'FORGOT_PASSWORD'],
      default: null,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpSentAt: {
      type: Date,
      default: null,
      select: false,
    },
    annualLeaveQuota: {
      type: Number,
      default: 12,
    },
    avatar: {
      type: String,
      default: null,
    },
    faceDescriptor: {
      type: [Number],
      default: undefined,
      select: false, // 128-dimensional vector (legacy single sample)
    },
    faceDescriptors: {
      type: [[Number]],
      default: undefined,
      select: false, // Array of 128-dimensional vectors (multi-angle samples: front, left, right)
    },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.otpCode;
        delete ret.otpExpiresAt;
        delete ret.otpType;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.otpCode;
        delete ret.otpExpiresAt;
        delete ret.otpType;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema, 'users');
