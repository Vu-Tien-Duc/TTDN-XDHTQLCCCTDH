let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  // Dự phòng cơ chế In-Memory Rate Limiting nếu chưa chạy 'npm i express-rate-limit'
  const attempts = new Map();
  rateLimit = (options) => {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 5;

    // Định kỳ dọn dẹp bộ nhớ mỗi 5 phút
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of attempts.entries()) {
        if (now - data.firstAttempt > windowMs) {
          attempts.delete(ip);
        }
      }
    }, 5 * 60 * 1000).unref();

    return (req, res, next) => {
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
      const now = Date.now();
      let record = attempts.get(clientIp);

      if (!record || now - record.firstAttempt > windowMs) {
        record = { count: 1, firstAttempt: now };
        attempts.set(clientIp, record);
        return next();
      }

      record.count += 1;
      if (record.count > max) {
        res.setHeader('Retry-After', Math.ceil((record.firstAttempt + windowMs - now) / 1000));
        return res.status(429).json({
          success: false,
          message: 'Bạn đã thử đăng nhập thất bại quá 5 lần. Vui lòng thử lại sau 15 phút để đảm bảo an toàn.',
          errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
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
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 request
  standardHeaders: true, // Trả về thông tin RateLimit trong headers
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

module.exports = {
  loginLimiter,
};
