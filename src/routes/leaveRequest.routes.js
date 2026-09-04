const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaveRequests,
  approveLeaveRequest,
} = require('../controllers/leaveRequest.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: LeaveRequests
 *   description: Quản lý Đơn xin nghỉ phép & Dạy bù
 */

router.use(verifyToken);

router.post('/', createLeaveRequest);
router.get('/', getLeaveRequests);
router.put('/:id/approve', authorizeRoles('ADMIN', 'MANAGER'), approveLeaveRequest);

module.exports = router;
