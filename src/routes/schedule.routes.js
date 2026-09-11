const express = require('express');
const router = express.Router();
const {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/schedule.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên/nhân viên có thể tra cứu lịch công tác và giảng dạy
router.get('/', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getSchedules);
router.get('/:id', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getScheduleById);

// Thao tác phân lịch công tác/giảng dạy chỉ dành cho Admin và Trưởng khoa
router.post('/', verifyRole(['admin', 'truongkhoa']), createSchedule);
router.put('/:id', verifyRole(['admin', 'truongkhoa']), updateSchedule);
router.delete('/:id', verifyRole(['admin', 'truongkhoa']), deleteSchedule);

module.exports = router;
