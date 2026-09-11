const express = require('express');
const router = express.Router();
const { getAttendanceReport } = require('../controllers/report.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Báo cáo tổng hợp chấm công chỉ dành cho Admin và Trưởng khoa
router.get('/attendance', verifyRole(['admin', 'truongkhoa']), getAttendanceReport);

module.exports = router;
