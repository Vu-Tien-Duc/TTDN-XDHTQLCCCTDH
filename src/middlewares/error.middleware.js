const { sendError } = require('../utils/responseHandler');

/**
 * Middleware xử lý lỗi hệ thống tập trung
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Lỗi máy chủ nội bộ';

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
