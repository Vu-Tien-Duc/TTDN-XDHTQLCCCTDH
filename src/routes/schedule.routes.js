const express = require('express');
const router = express.Router();
const {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/schedule.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Schedules
 *   description: Quản lý Lịch giảng dạy & Ca công tác
 */

router.use(verifyToken);

router.get('/', getSchedules);
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), createSchedule);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updateSchedule);
router.delete('/:id', authorizeRoles('ADMIN'), deleteSchedule);

module.exports = router;
