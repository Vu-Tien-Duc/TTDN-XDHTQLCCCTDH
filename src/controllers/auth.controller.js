const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

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

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    // Tạo refresh token (thời hạn 7 ngày)
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

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      annualLeaveQuota: user.annualLeaveQuota,
      isActive: user.isActive,
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
 * @desc Đăng ký người dùng mới (Dành cho Admin)
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { fullName, email, password, role, departmentId, annualLeaveQuota } = req.body;

    if (!fullName || !email || !password || !departmentId) {
      return sendError(res, 'Vui lòng cung cấp đầy đủ họ tên, email, mật khẩu và departmentId.', null, 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
    }

    // Mã hóa mật khẩu bcrypt với cost 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      role: role || 'giangvien',
      departmentId,
      annualLeaveQuota: annualLeaveQuota !== undefined ? annualLeaveQuota : 12,
    });

    const userData = {
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      departmentId: newUser.departmentId,
      annualLeaveQuota: newUser.annualLeaveQuota,
      isActive: newUser.isActive,
    };

    return sendSuccess(res, 'Tạo tài khoản người dùng thành công.', userData, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cấp mới Access Token từ Refresh Token
 * @route POST /api/v1/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return sendError(res, 'Vui lòng cung cấp refreshToken.', null, 400);
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
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    return sendSuccess(res, 'Cấp mới token thành công.', { token: newAccessToken });
  } catch (error) {
    return sendError(res, 'Refresh token không hợp lệ hoặc đã hết hạn.', null, 403);
  }
};

/**
 * @desc Đăng xuất - vô hiệu hóa Refresh Token
 * @route POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    return sendSuccess(res, 'Đăng xuất thành công.');
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
  refreshToken,
  logout,
  getMe,
};
