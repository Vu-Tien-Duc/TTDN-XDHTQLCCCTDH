const extractClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
};

const isLocalOrDev = (req) => {
  if (process.env.NODE_ENV === 'development') return true;
  const ip = extractClientIp(req);
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
};

let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  // Dự phòng cơ chế In-Memory Rate Limiting an toàn nếu chưa chạy 'npm i express-rate-limit'
  rateLimit = (options = {}) => {
    const attempts = new Map();
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const defaultMax = typeof options.max === 'number' ? options.max : 5;

    // Định kỳ dọn dẹp bộ nhớ mỗi 5 phút để tránh memory leak
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of attempts.entries()) {
        if (now - data.firstAttempt > windowMs) {
          attempts.delete(key);
        }
      }
    }, 5 * 60 * 1000);
    if (timer.unref) timer.unref();

    return (req, res, next) => {
      const key = typeof options.keyGenerator === 'function' ? options.keyGenerator(req, res) : extractClientIp(req);
      const effectiveMax = typeof options.max === 'function' 
        ? options.max(req, res) 
        : (isLocalOrDev(req) ? defaultMax * 10 : defaultMax);

      const now = Date.now();
      let record = attempts.get(key);

      if (!record || now - record.firstAttempt > windowMs) {
        record = { count: 1, firstAttempt: now };
        attempts.set(key, record);
      } else {
        record.count += 1;
      }

      // Nếu skipSuccessfulRequests được bật: trừ lại lượt khi request thành công (2xx, 3xx)
      if (options.skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode < 400 && record) {
            record.count = Math.max(0, record.count - 1);
          }
        });
      }

      if (options.standardHeaders) {
        const remaining = Math.max(0, effectiveMax - record.count);
        const resetTimeSec = Math.ceil((record.firstAttempt + windowMs) / 1000);
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
 * Key generator cho xác thực đăng nhập:
 * Kết hợp IP và email để không bị chặn lẫn nhau khi nhiều cán bộ/giảng viên dùng chung mạng/máy tính
 */
const getLoginRateKey = (req) => {
  const ip = extractClientIp(req);
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : 'anonymous';
  return `login_${ip}_${email}`;
};

/**
 * Key generator cho OTP:
 * Kết hợp IP và email/identifier
 */
const getOtpRateKey = (req) => {
  const ip = extractClientIp(req);
  const email = (req.body?.email || req.body?.identifier) ? String(req.body.email || req.body.identifier).toLowerCase().trim() : 'anonymous';
  return `otp_${ip}_${email}`;
};

/**
 * Giới hạn đăng nhập: Tối đa 5 lần ĐĂNG NHẬP SAI trong vòng 15 phút.
 * - skipSuccessfulRequests: true -> Đăng nhập thành công KHÔNG bị tính là lần thử thất bại.
 * - keyGenerator: Phân biệt theo tài khoản email để tránh chặn nhầm người dùng khác trên cùng mạng LAN/NAT.
 * - Môi trường localhost / dev cho phép tối đa 50 lần để thuận tiện kiểm thử.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 50 : 5),
  skipSuccessfulRequests: true, // CHỈ TÍNH LỖI (statusCode >= 400), đăng nhập thành công KHÔNG bị trừ lượt
  keyGenerator: getLoginRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Tài khoản này đã đăng nhập sai quá số lần quy định (5 lần). Vui lòng thử lại sau 15 phút để đảm bảo an toàn.',
      errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * Giới hạn yêu cầu gửi mã OTP quên mật khẩu: Tối đa 3 lần trong vòng 15 phút (môi trường dev: 20 lần)
 */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 20 : 3),
  keyGenerator: getOtpRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã yêu cầu gửi mã OTP quá 3 lần cho tài khoản này. Vui lòng chờ 15 phút trước khi thử lại.',
      errorCode: 'OTP_REQUEST_RATE_LIMIT_EXCEEDED',
      data: null,
    });
  },
});

/**
 * Giới hạn xác thực OTP và đổi mật khẩu: Tối đa 5 lần thử sai trong vòng 15 phút (môi trường dev: 30 lần)
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req) ? 30 : 5),
  skipSuccessfulRequests: true, // Xác thực thành công không tính là thất bại
  keyGenerator: getOtpRateKey,
  validate: { keyGenerator: false, xForwardedForHeader: false, default: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thử xác thực OTP sai quá 5 lần. Vui lòng chờ 15 phút trước khi thử lại.',
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
