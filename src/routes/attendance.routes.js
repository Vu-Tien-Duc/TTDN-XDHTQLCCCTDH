const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getAttendanceById,
  updateAttendanceByAdmin,
} = require('../controllers/attendance.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/history', getAttendanceHistory);
router.get('/:id', getAttendanceById);
router.put('/:id', authorizeRoles('admin'), updateAttendanceByAdmin);

module.exports = router;
