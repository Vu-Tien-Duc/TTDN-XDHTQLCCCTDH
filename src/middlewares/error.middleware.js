const { sendError } = require('../utils/responseHandler');

/**
 * Middleware xử lý lỗi hệ thống tập trung
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';

  // 1. Lỗi sai định dạng ObjectId Mongoose (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Định dạng định danh '${err.value}' không hợp lệ cho trường '${err.path}'.`;
  }

  // 2. Lỗi trùng lặp dữ liệu duy nhất trong MongoDB (E11000 duplicate key)
  if (err.code === 11000) {
    statusCode = 400;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'Dữ liệu';
    message = `${duplicatedField === 'email' ? 'Email' : duplicatedField} này đã tồn tại trên hệ thống.`;
  }

  // 3. Lỗi xác thực Schema Mongoose (ValidationError)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = `Dữ liệu không hợp lệ: ${errors.join(', ')}`;
  }

  // 4. Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ hoặc đã bị chỉnh sửa.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn. Vui lòng đăng nhập lại hoặc làm mới token.';
  }

  return sendError(res, message, process.env.NODE_ENV === 'development' ? err.stack : null, statusCode);
};

/**
 * Middleware xử lý đường dẫn không tồn tại (404 Not Found)
 */
const notFoundHandler = (req, res, next) => {
  return sendError(res, `Đường dẫn ${req.originalUrl} không tồn tại trên máy chủ.`, null, 404);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
