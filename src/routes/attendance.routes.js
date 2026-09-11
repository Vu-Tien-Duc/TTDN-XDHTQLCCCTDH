const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getAttendanceById,
  updateAttendanceByAdmin,
} = require('../controllers/attendance.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên/nhân viên đều có quyền check-in, check-out và tra cứu lịch sử của mình
router.post('/check-in', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), checkIn);
router.post('/check-out', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), checkOut);
router.get('/history', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getAttendanceHistory);
router.get('/:id', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getAttendanceById);

// Điều chỉnh dữ liệu chấm công thủ công (chỉ Admin)
router.put('/:id', verifyRole(['admin']), updateAttendanceByAdmin);

module.exports = router;
