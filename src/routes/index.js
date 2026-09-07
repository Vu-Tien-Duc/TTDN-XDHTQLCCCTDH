const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const departmentRoutes = require('./department.routes');
const shiftConfigRoutes = require('./shiftConfig.routes');
const scheduleRoutes = require('./schedule.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRequestRoutes = require('./leaveRequest.routes');
const auditLogRoutes = require('./auditLog.routes');
const reportRoutes = require('./report.routes');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    collectionsCount: 8,
    collections: [
      'users',
      'departments',
      'shift_configs',
      'schedules',
      'attendance_logs',
      'leave_requests',
      'audit_logs',
      'refresh_tokens',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Gắn các submodule routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/shifts', shiftConfigRoutes); // Chuẩn theo mục 3.3
router.use('/shift-configs', shiftConfigRoutes); // Alias hỗ trợ tên cũ
router.use('/schedules', scheduleRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
