const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  getLeaveBalance,
  approveLeaveRequest,
  rejectLeaveRequest,
} = require('../controllers/leaveRequest.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên/nhân viên đều có quyền nộp đơn và tra cứu đơn/quỹ phép của mình
router.post('/', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), createLeaveRequest);
router.get('/', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getLeaveRequests);
router.get('/balance', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getLeaveBalance);
router.get('/:id', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getLeaveRequestById);

// Phê duyệt hoặc từ chối đơn nghỉ phép (chỉ Admin hoặc Trưởng khoa)
router.put('/:id/approve', verifyRole(['admin', 'truongkhoa']), approveLeaveRequest);
router.put('/:id/reject', verifyRole(['admin', 'truongkhoa']), rejectLeaveRequest);

module.exports = router;
