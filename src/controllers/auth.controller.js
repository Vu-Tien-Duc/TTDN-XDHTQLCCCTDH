const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const TokenBlacklist = require('../models/tokenBlacklist.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { sendOtpEmail, sendRegistrationSuccessEmail } = require('../services/email.service');
const { uploadDir } = require('../middlewares/upload.middleware');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => crypto.createHmac('sha256', OTP_HASH_SECRET).update(String(otp).trim()).digest('hex');
const clearOtp = (user) => {
  user.otpCode = null;
  user.otpExpiresAt = null;
  user.otpType = null;
  user.otpAttempts = 0;
  user.otpSentAt = null;
};
const isOtpCooldownActive = (user) => user.otpSentAt && Date.now() - user.otpSentAt.getTime() < OTP_RESEND_COOLDOWN_MS;

/**
 * @desc Đăng nhập hệ thống
 * @route POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Vui lòng cung cấp email và mật khẩu.', null, 400);
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      AuditLog.create({
        actor: null,
        actorType: 'SYSTEM',
        action: 'USER_LOGIN_FAILED',
        targetId: email,
        targetType: 'User',
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        details: { email, reason: 'Email không tồn tại' },
      }).catch((err) => console.error('[AuditLog Error] Login failure:', err.message));
      return sendError(res, 'Email hoặc mật khẩu không chính xác.', null, 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      try {
        await AuditLog.create({
          actor: user._id,
          actorType: 'USER',
          action: 'USER_LOGIN_FAILED',
          targetId: user._id.toString(),
          targetType: 'User',
          ipAddress: req.ip || req.connection?.remoteAddress || null,
          details: { email: user.email, reason: 'Sai mật khẩu' },
        });
      } catch (err) {
        console.error('[AuditLog Error] Login failure:', err.message);
      }
      return sendError(res, 'Email hoặc mật khẩu không chính xác.', null, 401);
    }

    if (!user.isActive) {
      try {
        await AuditLog.create({
          actor: user._id,
          actorType: 'USER',
          action: 'USER_LOGIN_FAILED',
          targetId: user._id.toString(),
          targetType: 'User',
          ipAddress: req.ip || req.connection?.remoteAddress || null,
          details: { email: user.email, reason: 'Tài khoản bị vô hiệu hóa' },
        });
      } catch (err) {
        console.error('[AuditLog Error] Login failure:', err.message);
      }
      return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa.', null, 403);
    }

    // Kiểm tra tài khoản đã xác minh qua mã OTP chưa
    if (!user.isVerified) {
      return sendError(
        res,
        'Tài khoản chưa được xác minh qua mã OTP. Vui lòng kiểm tra email để xác minh tài khoản trước khi đăng nhập.',
        null,
        403
      );
    }

    // 1. Cấp Access Token: Thời hạn 15 phút theo chuẩn nghiệp vụ
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    // 2. Cấp Refresh Token: Thời hạn theo phiên làm việc (4 giờ)
    const refreshTokenExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const refreshTokenString = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '4h' }
    );

    await RefreshToken.create({
      token: refreshTokenString,
      userId: user._id,
      expiresAt: refreshTokenExpiresAt,
    });

    // 3. Lưu Refresh Token vào httpOnly session cookie (tự hủy khi tắt trình duyệt, không lưu vĩnh viễn trên máy)
    res.cookie('refreshToken', refreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    // Đồng bộ thông tin khoa trực thuộc
    await user.populate('departmentId', 'name type location');

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      annualLeaveQuota: user.annualLeaveQuota,
      isActive: user.isActive,
      isVerified: user.isVerified,
      avatar: user.avatar || null,
      phoneNumber: user.phoneNumber || null,
    };

    // Ghi nhận Audit Log đăng nhập thành công (await để đảm bảo ghi nhận trước khi hoàn tất phiên)
    try {
      await AuditLog.create({
        actor: user._id,
        actorType: 'USER',
        action: 'USER_LOGIN_SUCCESS',
        targetId: user._id.toString(),
        targetType: 'User',
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        details: { email: user.email, fullName: user.fullName, role: user.role },
      });
    } catch (err) {
      console.error('[AuditLog Error] Login success:', err.message);
    }

    return sendSuccess(res, 'Đăng nhập thành công.', {
      token,
      user: userData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Đăng ký tài khoản công khai (ĐÃ VÔ HIỆU HÓA THEO CHÍNH SÁCH BẢO MẬT NHÀ TRƯỜNG)
 * @route POST /api/v1/auth/register
 * @note Đây là hệ thống quản lý chấm công & đào tạo trường đại học. Giảng viên và nhân sự
 *       không được phép tự đăng ký tự do, toàn bộ tài khoản phải do Quản trị viên (Admin)
 *       khởi tạo và cấp phát theo email tên miền chính thức của nhà trường.
 */
const register = async (req, res) => {
  return sendError(
    res,
    'Hệ thống không hỗ trợ tự đăng ký tài khoản. Tài khoản cán bộ, giảng viên phải do Quản trị viên (Admin) nhà trường cấp theo quy chế phân quyền.',
    null,
    403
  );
};

/**
 * @desc Xác minh tài khoản bằng mã OTP (ĐÃ VÔ HIỆU HÓA do tính năng tự đăng ký đã đóng)
 * @route POST /api/v1/auth/verify-otp
 */
const verifyAccount = async (req, res) => {
  return sendError(
    res,
    'Quy trình xác minh tài khoản đăng ký công khai không còn khả dụng do tính năng tự đăng ký đã đóng. Mọi tài khoản được cấp bởi Quản trị viên đã được kích hoạt sẵn.',
    null,
    403
  );
};

/**
 * @desc Quên mật khẩu - Gửi mã OTP đặt lại mật khẩu (Thời hạn 10 phút)
 * @route POST /api/v1/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 'Vui lòng cung cấp email tài khoản cần đặt lại mật khẩu.', null, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+otpSentAt +otpAttempts');

    if (!user || !user.isActive || !user.isVerified) {
      return sendSuccess(res, 'Nếu email hợp lệ, mã OTP đặt lại mật khẩu sẽ được gửi đến email của bạn.', {
        email: normalizedEmail,
        expiresIn: '10 minutes',
      });
    }

    if (isOtpCooldownActive(user)) {
      return sendError(res, 'Vui lòng chờ 60 giây trước khi yêu cầu mã OTP mới.', null, 429);
    }

    // Sinh mã OTP 6 chữ số ngẫu nhiên
    const otp = generateOtp();
    user.otpCode = hashOtp(otp);
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpType = 'FORGOT_PASSWORD';
    user.otpAttempts = 0;
    user.otpSentAt = new Date();
    await user.save();

    // Gửi email OTP đặt lại mật khẩu
    await sendOtpEmail(user.email, user.fullName, otp, 'FORGOT_PASSWORD');

    return sendSuccess(
      res,
      'Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn. Mã có hiệu lực trong vòng 10 phút.',
      { email: user.email, expiresIn: '10 minutes' }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Xác thực OTP và Đặt lại mật khẩu mới
 * @route POST /api/v1/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return sendError(res, 'Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới.', null, 400);
    }

    if (newPassword.length < 6) {
      return sendError(res, 'Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.', null, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +otpCode +otpExpiresAt +otpType +otpAttempts +otpSentAt');

    if (!user || user.otpType !== 'FORGOT_PASSWORD') {
      return sendError(res, 'Yêu cầu đặt lại mật khẩu không hợp lệ hoặc mã OTP không chính xác.', null, 400);
    }

    const now = new Date();

    // 1. Kiểm tra hết hạn 10 phút
    if (!user.otpExpiresAt || now > user.otpExpiresAt) {
      clearOtp(user);
      await user.save();
      return sendError(res, 'Mã OTP đã hết hạn (quá 10 phút). Vui lòng gửi lại yêu cầu quên mật khẩu mới.', null, 400);
    }

    // 2. Kiểm tra mã OTP không khớp
    if (user.otpCode !== hashOtp(otp)) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
        clearOtp(user);
        await user.save();
        return sendError(res, 'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.', null, 429);
      }
      await user.save();
      return sendError(res, `Mã OTP không hợp lệ. Bạn còn ${OTP_MAX_ATTEMPTS - user.otpAttempts} lần thử.`, null, 400);
    }

    // 3. Cập nhật mật khẩu mới mã hóa bcrypt cost 12
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpType = null;
    user.otpAttempts = 0;
    user.otpSentAt = null;
    await user.save();

    // Thu hồi toàn bộ Refresh Token cũ để bảo mật
    await RefreshToken.deleteMany({ userId: user._id });

    // Ghi nhận Audit Log đặt lại mật khẩu thành công qua OTP (bắt buộc await để đảm bảo toàn vẹn audit)
    try {
      await AuditLog.create({
        actor: user._id,
        actorType: 'USER',
        action: 'RESET_PASSWORD',
        targetId: user._id.toString(),
        targetType: 'User',
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        details: { email: user.email, method: 'OTP' },
      });
    } catch (auditErr) {
      console.error('[AuditLog Error] Reset password:', auditErr.message);
    }

    return sendSuccess(res, 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cấp mới Access Token từ Refresh Token (Hỗ trợ đọc từ Cookie hoặc Body)
 * @route POST /api/v1/auth/refresh-token hoặc POST /api/v1/auth/refresh
 * @security Áp dụng atomic findOneAndDelete để ngăn chặn Race Condition (Replay attack)
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return sendError(res, 'Vui lòng cung cấp refreshToken qua Cookie hoặc Request Body.', null, 400);
    }

    // THAO TÁC NGUYÊN TỬ (Atomic): findOneAndDelete đảm bảo nếu 2 request đồng thời gửi cùng 1 token,
    // chỉ 1 request xóa thành công và nhận được token, request còn lại nhận null và bị chặn ngay.
    const savedToken = await RefreshToken.findOneAndDelete({ token });
    if (!savedToken) {
      return sendError(res, 'Refresh token không hợp lệ hoặc đã được sử dụng.', null, 403);
    }

    if (savedToken.expiresAt <= new Date()) {
      return sendError(res, 'Refresh token đã hết hạn.', null, 403);
    }

    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return sendError(res, 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa.', null, 403);
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const newRefreshTokenString = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '4h' }
    );

    await RefreshToken.create({
      token: newRefreshTokenString,
      userId: user._id,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });

    res.cookie('refreshToken', newRefreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    return sendSuccess(res, 'Cấp mới token thành công.', { token: newAccessToken });
  } catch (error) {
    return sendError(res, 'Refresh token không hợp lệ hoặc đã hết hạn.', null, 403);
  }
};

/**
 * @desc Đăng xuất - Thêm Access Token vào Blacklist & xóa Refresh Token / Cookie
 * @route POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    // 1. Đưa Access Token hiện tại vào Blacklist để vô hiệu hóa ngay lập tức
    const authHeader = req.headers.authorization;
    const accessToken = req.token || (authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null);

    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
        await TokenBlacklist.findOneAndUpdate(
          { token: accessToken },
          { token: accessToken, userId: decoded?.id || req.user?.id || null, expiresAt },
          { upsert: true }
        );
      } catch (err) {
        console.error('[Logout] Lỗi đưa token vào blacklist:', err);
      }
    }

    // 2. Vô hiệu hóa Refresh Token trong CSDL
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await RefreshToken.deleteOne({ token });
    }

    // 3. Xóa httpOnly cookie khỏi client
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    // 4. Ghi nhận Audit Log đăng xuất
    const decodedUser = accessToken ? jwt.decode(accessToken) : null;
    const actorId = decodedUser?.id || req.user?.id || null;
    if (actorId) {
      try {
        await AuditLog.create({
          actor: actorId,
          actorType: 'USER',
          action: 'USER_LOGOUT',
          targetId: actorId.toString(),
          targetType: 'User',
          ipAddress: req.ip || req.connection?.remoteAddress || null,
          details: { reason: 'Người dùng chủ động đăng xuất' },
        });
      } catch (err) {
        console.error('[AuditLog Error] Logout:', err.message);
      }
    }

    return sendSuccess(res, 'Đăng xuất thành công. Token đã được thu hồi và đưa vào blacklist.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Lấy thông tin cá nhân hiện tại
 * @route GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('departmentId', 'name type location');
    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404);
    }
    return sendSuccess(res, 'Lấy thông tin người dùng thành công.', user);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Đổi mật khẩu cho người dùng đang đăng nhập
 * @route PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới.', null, 400);
    }
    if (newPassword.length < 6) {
      return sendError(res, 'Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.', null, 400);
    }

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Mật khẩu hiện tại không chính xác.', null, 400, 'INVALID_CREDENTIALS');
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    await user.save();

    // Thu hồi toàn bộ Refresh Token cũ để ép các thiết bị/phiên khác phải đăng nhập lại
    await RefreshToken.deleteMany({ userId: user._id });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    // Ghi nhận Audit Log đổi mật khẩu thành công (await để đảm bảo toàn vẹn nhật ký)
    try {
      await AuditLog.create({
        actor: user._id,
        actorType: 'USER',
        action: 'CHANGE_PASSWORD',
        targetId: user._id.toString(),
        targetType: 'User',
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        details: { email: user.email },
      });
    } catch (err) {
      console.error('[AuditLog Error] Change password:', err.message);
    }

    return sendSuccess(res, 'Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho các lần đăng nhập tiếp theo.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cập nhật ảnh đại diện / ảnh mẫu Face ID của người dùng
 * @route PUT /api/auth/avatar hoặc POST /api/auth/avatar
 */
const updateAvatar = async (req, res, next) => {
  try {
    let avatar = null;
    let faceDescriptor = req.body?.faceDescriptor;

    // 1. Kiểm tra nếu client tải file ảnh trực tiếp (multipart/form-data)
    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (uploadedFile) {
      avatar = `/uploads/${uploadedFile.filename}`;
    } else if (req.body?.avatar) {
      avatar = req.body.avatar;
    } else if (req.body?.image) {
      avatar = req.body.image;
    } else if (req.body?.fileUrl) {
      avatar = req.body.fileUrl;
    } else if (req.body?.file) {
      avatar = req.body.file;
    }

    // 2. Hỗ trợ Mobile App gửi chuỗi Base64
    if (typeof avatar === 'string' && avatar.startsWith('data:image/')) {
      const matches = avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        avatar = `/uploads/${filename}`;
      }
    }

    if (!avatar) {
      return sendError(res, 'Vui lòng cung cấp file ảnh hoặc đường dẫn ảnh đại diện.', null, 400);
    }

    if (typeof faceDescriptor === 'string') {
      try {
        faceDescriptor = JSON.parse(faceDescriptor);
      } catch (e) {
        // bỏ qua nếu không parse được
      }
    }

    const updateData = { avatar };
    if (Array.isArray(faceDescriptor) && faceDescriptor.length === 128) {
      updateData.faceDescriptor = faceDescriptor;
    }

    // Luôn lưu URL tuyệt đối vào CSDL để hoạt động đúng trên mọi môi trường (VPS/Nginx)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host');
    const fullAvatarUrl = avatar.startsWith('http') ? avatar : `${protocol}://${host}${avatar}`;
    updateData.avatar = fullAvatarUrl;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    ).populate('departmentId', 'name type location');

    if (!user) {
      return sendError(res, 'Không tìm thấy thông tin người dùng.', null, 404);
    }

    // Ghi nhận Audit Log cập nhật ảnh đại diện / khuôn mặt
    AuditLog.create({
      actor: user._id,
      actorType: 'USER',
      action: 'UPDATE_AVATAR',
      targetId: user._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      details: { hasFaceDescriptor: Array.isArray(faceDescriptor) && faceDescriptor.length === 128 },
    }).catch((err) => console.error('[AuditLog Error] Update avatar:', err.message));

    return sendSuccess(res, 'Cập nhật ảnh khuôn mặt / đại diện thành công.', {
      ...user.toObject(),
      avatar: fullAvatarUrl,
      avatarUrl: fullAvatarUrl,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  verifyAccount,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
  changePassword,
  updateAvatar,
};
