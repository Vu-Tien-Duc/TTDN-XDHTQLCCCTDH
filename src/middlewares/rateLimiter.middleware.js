let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  // Dự phòng cơ chế In-Memory Rate Limiting an toàn nếu chưa chạy 'npm i express-rate-limit'
  rateLimit = (options = {}) => {
    const attempts = new Map();
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 5;

    // Định kỳ dọn dẹp bộ nhớ mỗi 5 phút để tránh memory leak
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of attempts.entries()) {
        if (now - data.firstAttempt > windowMs) {
          attempts.delete(ip);
        }
      }
    }, 5 * 60 * 1000);
    if (timer.unref) timer.unref();

    return (req, res, next) => {
      // Xác định địa chỉ IP thực tế (hỗ trợ reverse proxy/Nginx qua x-forwarded-for)
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
                    req.ip ||
                    req.socket?.remoteAddress ||
                    req.connection?.remoteAddress ||
                    'unknown';

      const isLocalhost = rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '::ffff:127.0.0.1' || rawIp === 'localhost';
      const effectiveMax = process.env.NODE_ENV === 'development' || isLocalhost ? max * 10 : max;
      const now = Date.now();
      let record = attempts.get(rawIp);

      if (!record || now - record.firstAttempt > windowMs) {
        record = { count: 1, firstAttempt: now };
        attempts.set(rawIp, record);

        if (options.standardHeaders) {
          res.setHeader('RateLimit-Limit', effectiveMax);
          res.setHeader('RateLimit-Remaining', effectiveMax - 1);
          res.setHeader('RateLimit-Reset', Math.ceil((record.firstAttempt + windowMs) / 1000));
        }
        return next();
      }

      record.count += 1;
      const remaining = Math.max(0, effectiveMax - record.count);
      const resetTimeSec = Math.ceil((record.firstAttempt + windowMs) / 1000);

      if (options.standardHeaders) {
        res.setHeader('RateLimit-Limit', effectiveMax);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', resetTimeSec);
      }

      if (record.count > effectiveMax) {
        const retryAfterSec = Math.max(1, Math.ceil((record.firstAttempt + windowMs - now) / 1000));
        res.setHeader('Retry-After', retryAfterSec);

        if (typeof options.handler === 'function') {
          return options.handler(req, res, next);
        }
        return res.status(429).json({
          success: false,
          message: options.message || 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.',
          errorCode: options.errorCode || 'RATE_LIMIT_EXCEEDED',
          data: null,
        });
      }

      next();
    };
  };
}

/**
 * Giới hạn đăng nhập: Tối đa 5 lần thử trong vòng 15 phút
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thử đăng nhập thất bại quá 5 lần. Vui lòng thử lại sau 15 phút để đảm bảo an toàn.',
      errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * Giới hạn yêu cầu gửi mã OTP quên mật khẩu: Tối đa 3 lần trong vòng 15 phút
 */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã yêu cầu gửi mã OTP quá 3 lần. Vui lòng chờ 15 phút trước khi thử lại.',
      errorCode: 'OTP_REQUEST_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * Giới hạn xác thực OTP và đổi mật khẩu: Tối đa 5 lần thử trong vòng 15 phút
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thử xác thực OTP quá 5 lần. Vui lòng chờ 15 phút trước khi thử lại.',
      errorCode: 'OTP_VERIFY_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

module.exports = {
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
};
