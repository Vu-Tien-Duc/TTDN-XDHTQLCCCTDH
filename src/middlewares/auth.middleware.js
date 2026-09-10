const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/tokenBlacklist.model');
const User = require('../models/user.model');
const { sendError } = require('../utils/responseHandler');

/**
 * Middleware xác thực token JWT người dùng (Kiểm tra format, Blacklist, Expiration, trạng thái User)
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendError(res, 'Truy cập bị từ chối. Token không tồn tại.', null, 401);
    }

    // Chấp nhận cả "Bearer <token>" và token thô; xử lý tối đa 2 lần tiền tố Bearer
    const token = authHeader
      .replace(/^Bearer\s+/i, '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token) {
      return sendError(res, 'Truy cập bị từ chối. Định dạng token không hợp lệ.', null, 401);
    }

    // 1. Kiểm tra xem Access Token có nằm trong danh sách Blacklist (đã logout) hay không
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return sendError(res, 'Token đã bị vô hiệu hóa do đăng xuất. Vui lòng đăng nhập lại.', null, 401);
    }

    // 2. Xác thực tính hợp lệ và thời hạn của Token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token đã hết hạn. Vui lòng làm mới token hoặc đăng nhập lại.', null, 401);
      }
      return sendError(res, 'Token không hợp lệ hoặc đã bị giả mạo.', null, 401);
    }

    // 3. Kiểm tra người dùng có còn tồn tại và còn hoạt động hay không
    const user = await User.findById(decoded.id).select('role departmentId isActive');
    if (!user) {
      return sendError(res, 'Người dùng không tồn tại trên hệ thống.', null, 401);
    }
    if (!user.isActive) {
      return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa.', null, 403);
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      departmentId: user.departmentId ? user.departmentId.toString() : null,
      email: decoded.email,
    };
    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware phân quyền người dùng (Role-based Authorization)
 * @param  {...string} allowedRoles Các vai trò được phép truy cập: 'admin', 'truongkhoa', 'giangvien', 'nhanvien'
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Bạn không có quyền thực hiện hành động này.', null, 403);
    }
    next();
  };
};

module.exports = {
  verifyToken,
  authorizeRoles,
};
