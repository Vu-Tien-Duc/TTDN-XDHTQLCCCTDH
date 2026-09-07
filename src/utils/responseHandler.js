/**
 * Chuẩn hóa phản hồi thành công (Success Response)
 * Tuân thủ cấu trúc thống nhất { success, data, message }
 */
const sendSuccess = (res, message = 'Thành công', data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

/**
 * Chuẩn hóa phản hồi lỗi (Error Response)
 * Tuân thủ cấu trúc thống nhất { success, message, errorCode, errors }
 */
const sendError = (res, message = 'Có lỗi xảy ra', errors = null, statusCode = 500, errorCode = null) => {
  const response = {
    success: false,
    message,
  };

  if (errorCode) {
    response.errorCode = errorCode;
  }

  if (errors !== null && errors !== undefined) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError,
};

