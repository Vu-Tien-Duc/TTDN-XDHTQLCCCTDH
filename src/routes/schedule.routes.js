const express = require('express');
const router = express.Router();
const {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/schedule.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', getSchedules);
router.get('/:id', getScheduleById);
router.post('/', authorizeRoles('admin', 'truongkhoa'), createSchedule);
router.put('/:id', authorizeRoles('admin', 'truongkhoa'), updateSchedule);
router.delete('/:id', authorizeRoles('admin', 'truongkhoa'), deleteSchedule);

module.exports = router;
