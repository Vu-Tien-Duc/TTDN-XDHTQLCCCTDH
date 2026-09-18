const express = require('express');
const router = express.Router();
const { handleAiChat } = require('../controllers/ai.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Endpoint nhận câu hỏi của Thanh tra đào tạo
router.post('/chat', handleAiChat);

module.exports = router;
