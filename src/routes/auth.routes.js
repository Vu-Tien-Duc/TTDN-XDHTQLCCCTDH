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
const { upload } = require('../middlewares/upload.middleware');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middlewares/rateLimiter.middleware');

// Middleware hỗ trợ upload ảnh (nếu client gửi multipart/form-data) hoặc bỏ qua nếu là JSON
const handleAvatarUpload = (req, res, next) => {
  upload.any()(req, res, function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Lỗi khi tải file ảnh lên.',
      });
    }
    next();
  });
};

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

// 2. Tuyến đường đăng ký công khai (Bị chặn 403 - Chỉ Admin mới có quyền tạo tài khoản tại /api/v1/users)
router.post('/register', register);
router.post('/verify-otp', otpVerifyLimiter, verifyAccount);
router.post('/verify-account', otpVerifyLimiter, verifyAccount);

// 3. Quên mật khẩu & Đặt lại mật khẩu qua OTP
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/reset-password', otpVerifyLimiter, resetPassword);

// 4. Quản lý phiên & Token
router.post('/refresh-token', refreshToken);
router.post('/refresh', refreshToken); // Alias hỗ trợ theo mục 3.1
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);
router.put('/change-password', verifyToken, changePassword);

// 5. Cập nhật ảnh đại diện / khuôn mặt (Hỗ trợ cả PUT & POST, multipart & JSON)
router.put('/avatar', verifyToken, handleAvatarUpload, updateAvatar);
router.post('/avatar', verifyToken, handleAvatarUpload, updateAvatar);

module.exports = router;

