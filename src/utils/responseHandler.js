/**
 * Chuẩn hóa phản hồi thành công (Success Response)
 */
const sendSuccess = (res, message = 'Thành công', data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Chuẩn hóa phản hồi lỗi (Error Response)
 */
const sendError = (res, message = 'Có lỗi xảy ra', errors = null, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
