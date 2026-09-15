const express = require('express');
const router = express.Router();
const { getAttendanceReport, getMonthlyReport } = require('../controllers/report.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Báo cáo tổng hợp chấm công: Cá nhân xem của mình, Trưởng khoa xem của khoa, Admin xem toàn trường
router.get('/attendance', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getAttendanceReport);

// Báo cáo chi tiết theo tháng: Dành cho Admin và Trưởng khoa
router.get('/monthly', verifyRole(['admin', 'truongkhoa']), getMonthlyReport);

module.exports = router;
