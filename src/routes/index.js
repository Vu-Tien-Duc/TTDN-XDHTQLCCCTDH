const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const departmentRoutes = require('./department.routes');
const scheduleRoutes = require('./schedule.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRequestRoutes = require('./leaveRequest.routes');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    timestamp: new Date().toISOString(),
  });
});

// Gắn các submodule routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-requests', leaveRequestRoutes);

module.exports = router;
