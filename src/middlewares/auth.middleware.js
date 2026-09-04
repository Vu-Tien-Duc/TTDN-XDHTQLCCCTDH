const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/responseHandler');

/**
 * Middleware xác thực token JWT người dùng
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Truy cập bị từ chối. Token không tồn tại hoặc không đúng định dạng.', null, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, 'Token không hợp lệ hoặc đã hết hạn.', null, 403);
  }
};

/**
 * Middleware phân quyền người dùng (Role-based Authorization)
 * @param  {...string} allowedRoles Các vai trò được phép truy cập ('admin', 'lecturer', 'staff', etc.)
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
