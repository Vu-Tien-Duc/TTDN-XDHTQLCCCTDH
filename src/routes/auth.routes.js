const express = require('express');
const router = express.Router();
const { login, register, refreshToken, logout, getMe } = require('../controllers/auth.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

// Hướng dẫn nếu vô tình gọi GET /login
router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Phương thức GET không được hỗ trợ cho route này. Vui lòng gửi HTTP POST với Body JSON { email, password } để đăng nhập.',
    hint: 'Sử dụng POST /api/auth/login',
  });
});

router.post('/login', login);
router.post('/register', verifyToken, authorizeRoles('admin'), register);
router.post('/refresh-token', refreshToken);
router.post('/refresh', refreshToken); // Alias hỗ trợ theo mục 3.1
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);

module.exports = router;
