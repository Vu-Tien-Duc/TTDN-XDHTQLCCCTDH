const express = require('express');
const router = express.Router();
const {
  login,
  register,
  verifyAccount,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
  changePassword,
  updateAvatar,
} = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimiter.middleware');

// Hướng dẫn nếu vô tình gọi GET /login
router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Phương thức GET không được hỗ trợ cho route này. Vui lòng gửi HTTP POST với Body JSON { email, password } để đăng nhập.',
    hint: 'Sử dụng POST /api/auth/login',
  });
});

// 1. Xác thực & Đăng nhập (Áp dụng Rate Limiting tối đa 5 lần / 15 phút)
router.post('/login', loginLimiter, login);

// 2. Đăng ký tài khoản & Xác thực OTP 10 phút
router.post('/register', register);
router.post('/verify-otp', verifyAccount);
router.post('/verify-account', verifyAccount); // Alias

// 3. Quên mật khẩu & Đặt lại mật khẩu qua OTP
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 4. Quản lý phiên & Token
router.post('/refresh-token', refreshToken);
router.post('/refresh', refreshToken); // Alias hỗ trợ theo mục 3.1
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);
router.put('/change-password', verifyToken, changePassword);
router.put('/avatar', verifyToken, updateAvatar);

module.exports = router;

