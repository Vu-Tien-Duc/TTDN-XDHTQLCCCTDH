const { sendError } = require('../utils/responseHandler');

/**
 * Middleware xử lý lỗi hệ thống tập trung
 */
const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

  // 1. Lỗi sai định dạng ObjectId Mongoose (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Định dạng định danh '${err.value}' không hợp lệ cho trường '${err.path}'.`;
    errorCode = 'INVALID_OBJECT_ID';
  }

  // 2. Lỗi trùng lặp dữ liệu duy nhất trong MongoDB (E11000 duplicate key)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'Dữ liệu';
    message = `${duplicatedField === 'email' ? 'Email' : duplicatedField} này đã tồn tại trên hệ thống.`;
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  // 3. Lỗi xác thực Schema Mongoose (ValidationError)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = `Dữ liệu không hợp lệ: ${errors.join(', ')}`;
    errorCode = 'VALIDATION_ERROR';
  }

  // 4. Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ hoặc đã bị chỉnh sửa.';
    errorCode = 'AUTH_TOKEN_INVALID';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn. Vui lòng đăng nhập lại hoặc làm mới token.';
    errorCode = 'AUTH_TOKEN_EXPIRED';
  }

  return sendError(
    res,
    message,
    process.env.NODE_ENV === 'development' ? err.stack : null,
    statusCode,
    errorCode
  );
};

/**
 * Middleware xử lý đường dẫn không tồn tại (404 Not Found)
 */
const notFoundHandler = (req, res, next) => {
  return sendError(
    res,
    `Đường dẫn ${req.originalUrl} không tồn tại trên máy chủ.`,
    null,
    404,
    'RESOURCE_NOT_FOUND'
  );
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
