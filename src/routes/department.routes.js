const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/department.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: Quản lý Khoa / Bộ môn / Phòng ban
 */

router.get('/', getAllDepartments);

router.use(verifyToken);
router.post('/', authorizeRoles('ADMIN'), createDepartment);
router.put('/:id', authorizeRoles('ADMIN'), updateDepartment);
router.delete('/:id', authorizeRoles('ADMIN'), deleteDepartment);

module.exports = router;
