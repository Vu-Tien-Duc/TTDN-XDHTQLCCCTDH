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
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.post('/', createLeaveRequest);
router.get('/', getLeaveRequests);
router.get('/balance', getLeaveBalance);
router.get('/:id', getLeaveRequestById);
router.put('/:id/approve', authorizeRoles('admin', 'truongkhoa'), approveLeaveRequest);
router.put('/:id/reject', authorizeRoles('admin', 'truongkhoa'), rejectLeaveRequest);

module.exports = router;
