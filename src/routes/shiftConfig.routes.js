const express = require('express');
const router = express.Router();
const {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
} = require('../controllers/shiftConfig.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên/nhân viên có thể tra cứu thông tin ca làm việc chuẩn
router.get('/', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getAllShiftConfigs);
router.get('/:id', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getShiftConfigById);

// Thao tác cấu hình ca chỉ dành cho Admin
router.post('/', verifyRole(['admin']), createShiftConfig);
router.put('/:id', verifyRole(['admin']), updateShiftConfig);
router.delete('/:id', verifyRole(['admin']), deleteShiftConfig);

module.exports = router;
