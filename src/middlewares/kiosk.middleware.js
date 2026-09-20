const { sendError } = require('../utils/responseHandler');

/**
 * Middleware xác thực khóa Kiosk (x-kiosk-key)
 * Chỉ cho phép request từ thiết bị Kiosk có key hợp lệ
 */
const verifyKioskKey = (req, res, next) => {
  const kioskKey = req.headers['x-kiosk-key'];
  const validKey = process.env.KIOSK_KEY;

  if (!validKey) {
    console.warn('[Kiosk] KIOSK_KEY chưa được cấu hình trong .env');
    return sendError(res, 'Hệ thống chưa cấu hình khóa Kiosk.', null, 500);
  }

  if (!kioskKey) {
    return sendError(res, 'Thiếu header x-kiosk-key. Truy cập bị từ chối.', null, 401);
  }

  if (kioskKey !== validKey) {
    return sendError(res, 'Khóa Kiosk không hợp lệ.', null, 403);
  }

  next();
};

/**
 * Rate Limiter cho Kiosk (In-memory, tối đa 15 requests / phút theo IP)
 * Phòng chống brute-force gửi vector khuôn mặt giả
 */
const kioskRateLimitStore = new Map(); // Map<IP, { count, resetTime }>
const KIOSK_RATE_LIMIT = 15; // requests
const KIOSK_RATE_WINDOW = 60 * 1000; // 1 phút

const kioskRateLimit = (req, res, next) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  const entry = kioskRateLimitStore.get(clientIp);

  if (!entry || now > entry.resetTime) {
    // Reset hoặc khởi tạo
    kioskRateLimitStore.set(clientIp, { count: 1, resetTime: now + KIOSK_RATE_WINDOW });
    return next();
  }

  if (entry.count >= KIOSK_RATE_LIMIT) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return sendError(
      res,
      `Kiosk đã vượt giới hạn ${KIOSK_RATE_LIMIT} lần quét/phút. Thử lại sau ${retryAfterSec}s.`,
      null,
      429
    );
  }

  entry.count++;
  next();
};

// Dọn dẹp entries cũ mỗi 5 phút (tránh memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of kioskRateLimitStore) {
    if (now > entry.resetTime) {
      kioskRateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  verifyKioskKey,
  kioskRateLimit,
};
