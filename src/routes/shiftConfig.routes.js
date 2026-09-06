const express = require('express');
const router = express.Router();
const {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
} = require('../controllers/shiftConfig.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', getAllShiftConfigs);
router.get('/:id', getShiftConfigById);
router.post('/', authorizeRoles('admin'), createShiftConfig);
router.put('/:id', authorizeRoles('admin'), updateShiftConfig);
router.delete('/:id', authorizeRoles('admin'), deleteShiftConfig);

module.exports = router;
