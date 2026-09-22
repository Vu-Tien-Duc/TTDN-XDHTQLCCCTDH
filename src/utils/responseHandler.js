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
  getBaseUrl: (req) => {
    const host = req.get('host') || '';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://${host}`;
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isHttps =
      forwardedProto === 'https' ||
      req.secure ||
      req.protocol === 'https' ||
      host.includes('chamcongdh.io.vn');

    const proto = isHttps ? 'https' : (req.protocol || 'http');
    return `${proto}://${host}`;
  },
};

