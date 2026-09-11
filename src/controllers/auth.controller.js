const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const TokenBlacklist = require('../models/tokenBlacklist.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { sendOtpEmail, sendRegistrationSuccessEmail } = require('../services/email.service');

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
      return sendError(res, 'Email hoặc mật khẩu không chính xác.', null, 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Email hoặc mật khẩu không chính xác.', null, 401);
    }

    if (!user.isActive) {
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
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    // 2. Cấp Refresh Token: Thời hạn 7 ngày
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const refreshTokenString = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_key',
      { expiresIn: '7d' }
    );

    await RefreshToken.create({
      token: refreshTokenString,
      userId: user._id,
      expiresAt: refreshTokenExpiresAt,
    });

    // 3. Lưu Refresh Token vào httpOnly cookie (Bảo mật XSS)
    res.cookie('refreshToken', refreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      annualLeaveQuota: user.annualLeaveQuota,
      isActive: user.isActive,
      isVerified: user.isVerified,
    };

    return sendSuccess(res, 'Đăng nhập thành công.', {
      token,
      refreshToken: refreshTokenString,
      user: userData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Đăng ký tài khoản người dùng mới & Gửi mã OTP xác thực (TTL 10 phút)
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { fullName, email, password, role, departmentId, annualLeaveQuota } = req.body;

    if (!fullName || !email || !password || !departmentId) {
      return sendError(res, 'Vui lòng cung cấp đầy đủ họ tên, email, mật khẩu và departmentId.', null, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    // Nếu tài khoản đã tồn tại và đã xác minh
    if (existingUser && existingUser.isVerified) {
      return sendError(res, 'Email này đã được sử dụng bởi một tài khoản đã kích hoạt.', null, 400);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Sinh mã OTP 6 chữ số ngẫu nhiên có hạn 10 phút
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let targetUser;

    // Nếu tài khoản đã đăng ký trước đó nhưng chưa xác minh -> cập nhật lại và cấp OTP mới
    if (existingUser && !existingUser.isVerified) {
      existingUser.fullName = fullName;
      existingUser.passwordHash = passwordHash;
      existingUser.role = role || existingUser.role || 'giangvien';
      existingUser.departmentId = departmentId;
      existingUser.annualLeaveQuota = annualLeaveQuota !== undefined ? annualLeaveQuota : 12;
      existingUser.otpCode = otp;
      existingUser.otpExpiresAt = otpExpiresAt;
      existingUser.otpType = 'VERIFY_ACCOUNT';
      targetUser = await existingUser.save();
    } else {
      targetUser = await User.create({
        fullName,
        email: normalizedEmail,
        passwordHash,
        role: role || 'giangvien',
        departmentId,
        annualLeaveQuota: annualLeaveQuota !== undefined ? annualLeaveQuota : 12,
        isActive: true,
        isVerified: false,
        otpCode: otp,
        otpExpiresAt,
        otpType: 'VERIFY_ACCOUNT',
      });
    }

    // Gửi email OTP (kèm fallback in ra terminal)
    await sendOtpEmail(targetUser.email, targetUser.fullName, otp, 'VERIFY_ACCOUNT');

    return sendSuccess(
      res,
      'Đăng ký tài khoản thành công! Mã OTP 6 chữ số đã được gửi đến email của bạn. Vui lòng xác minh trong vòng 10 phút.',
      {
        email: targetUser.email,
        fullName: targetUser.fullName,
        expiresIn: '10 minutes',
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Xác minh tài khoản bằng mã OTP (Nếu quá 10 phút -> Xóa tài khoản)
 * @route POST /api/v1/auth/verify-otp
 */
const verifyAccount = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendError(res, 'Vui lòng cung cấp email và mã OTP 6 chữ số.', null, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+otpCode +otpExpiresAt +otpType');

    if (!user) {
      return sendError(res, 'Không tìm thấy tài khoản với email này.', null, 404);
    }

    if (user.isVerified) {
      return sendSuccess(res, 'Tài khoản này đã được xác minh trước đó. Bạn có thể đăng nhập ngay.');
    }

    if (user.otpType !== 'VERIFY_ACCOUNT') {
      return sendError(res, 'Yêu cầu xác minh không hợp lệ. Vui lòng đăng ký lại.', null, 400);
    }

    const now = new Date();

    // 1. Nếu quá 10 phút -> Xóa tài khoản khỏi CSDL
    if (!user.otpExpiresAt || now > user.otpExpiresAt) {
      await User.deleteOne({ _id: user._id });
      return sendError(
        res,
        'Mã OTP đã hết hạn (quá 10 phút). Tài khoản chưa xác minh đã bị xóa khỏi hệ thống. Vui lòng thực hiện đăng ký lại.',
        null,
        400
      );
    }

    // 2. Kiểm tra mã OTP không khớp
    if (user.otpCode !== otp.toString().trim()) {
      return sendError(res, 'Mã OTP không hợp lệ.', null, 400);
    }

    // 3. Hợp lệ trong vòng 10 phút -> Kích hoạt tài khoản
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpType = null;
    await user.save();

    // Gửi email chúc mừng tạo tài khoản thành công
    await sendRegistrationSuccessEmail(user.email, user.fullName);

    return sendSuccess(res, 'Xác minh tài khoản thành công! Bạn có thể đăng nhập vào hệ thống ngay bây giờ.', {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      isVerified: user.isVerified,
    });
  } catch (error) {
    next(error);
  }
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
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng với email này.', null, 404);
    }

    if (!user.isActive) {
      return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.', null, 403);
    }

    if (!user.isVerified) {
      return sendError(res, 'Tài khoản chưa được kích hoạt qua mã OTP. Vui lòng xác minh tài khoản trước.', null, 403);
    }

    // Sinh mã OTP 6 chữ số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
    user.otpType = 'FORGOT_PASSWORD';
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
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +otpCode +otpExpiresAt +otpType');

    if (!user) {
      return sendError(res, 'Không tìm thấy tài khoản với email này.', null, 404);
    }

    if (user.otpType !== 'FORGOT_PASSWORD') {
      return sendError(res, 'Yêu cầu đặt lại mật khẩu không hợp lệ. Vui lòng gửi lại yêu cầu quên mật khẩu.', null, 400);
    }

    const now = new Date();

    // 1. Kiểm tra hết hạn 10 phút
    if (!user.otpExpiresAt || now > user.otpExpiresAt) {
      user.otpCode = null;
      user.otpExpiresAt = null;
      user.otpType = null;
      await user.save();
      return sendError(res, 'Mã OTP đã hết hạn (quá 10 phút). Vui lòng gửi lại yêu cầu quên mật khẩu mới.', null, 400);
    }

    // 2. Kiểm tra mã OTP không khớp
    if (user.otpCode !== otp.toString().trim()) {
      return sendError(res, 'Mã OTP không hợp lệ.', null, 400);
    }

    // 3. Cập nhật mật khẩu mới mã hóa bcrypt cost 12
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpType = null;
    await user.save();

    // Thu hồi toàn bộ Refresh Token cũ để bảo mật
    await RefreshToken.deleteMany({ userId: user._id });

    return sendSuccess(res, 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cấp mới Access Token từ Refresh Token (Hỗ trợ đọc từ Cookie hoặc Body)
 * @route POST /api/v1/auth/refresh-token hoặc POST /api/v1/auth/refresh
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return sendError(res, 'Vui lòng cung cấp refreshToken qua Cookie hoặc Request Body.', null, 400);
    }

    const savedToken = await RefreshToken.findOne({ token });
    if (!savedToken) {
      return sendError(res, 'Refresh token không hợp lệ hoặc đã hết hạn.', null, 403);
    }

    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_key');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return sendError(res, 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa.', null, 403);
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

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
    const accessToken = req.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

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

module.exports = {
  login,
  register,
  verifyAccount,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
};
