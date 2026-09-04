const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
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

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return sendError(res, 'Email hoặc mật khẩu không chính xác.', null, 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Email hoặc mật khẩu không chính xác.', null, 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa.', null, 403);
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, userCode: user.userCode },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const userData = {
      _id: user._id,
      userCode: user.userCode,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
    };

    return sendSuccess(res, 'Đăng nhập thành công.', { token, user: userData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Đăng ký người dùng mới (Dành cho Admin/Hệ thống)
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { userCode, fullName, email, password, role, department, title } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { userCode }] });
    if (existingUser) {
      return sendError(res, 'Email hoặc Mã cán bộ đã tồn tại trên hệ thống.', null, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      userCode,
      fullName,
      email,
      password: hashedPassword,
      role: role || 'LECTURER',
      department,
      title,
    });

    const userData = {
      _id: newUser._id,
      userCode: newUser.userCode,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
    };

    return sendSuccess(res, 'Tạo tài khoản người dùng thành công.', userData, 201);
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
    const user = await User.findById(req.user.id).populate('department', 'code name type');
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
  getMe,
};
