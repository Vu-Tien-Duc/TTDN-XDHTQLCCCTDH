/**
 * Chuẩn hóa phản hồi thành công (Success Response)
 * Tuân thủ cấu trúc thống nhất { success, data, message, errorCode }
 */
const sendSuccess = (res, message = 'Thành công', data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    errorCode: null,
  });
};

/**
 * Chuẩn hóa phản hồi lỗi (Error Response)
 * Tuân thủ cấu trúc thống nhất { success, data, message, errorCode, errors }
 */
const sendError = (res, message = 'Có lỗi xảy ra', errors = null, statusCode = 500, errorCode = null) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    errorCode: errorCode || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    errors: errors !== undefined ? errors : null,
  });
};

module.exports = {
  sendSuccess,
  sendError,
  /**
   * Lấy base URL đúng protocol (https khi chạy sau Nginx/VPS, http khi local dev)
   * Ưu tiên: x-forwarded-proto header > CLIENT_URL env > req.protocol
   */
  getBaseUrl: (req) => {
    const proto = req.headers['x-forwarded-proto'] ||
      (process.env.CLIENT_URL?.startsWith('https') ? 'https' : null) ||
      req.protocol ||
      'http';
    const host = req.get('host');
    return `${proto}://${host}`;
  },
};

