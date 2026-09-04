const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản lý thông tin Giảng viên & Cán bộ nhân viên
 */

router.use(verifyToken);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Lấy danh sách Giảng viên / Cán bộ
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 */
router.get('/', getAllUsers);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Lấy chi tiết thông tin người dùng theo ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin chi tiết
 */
router.get('/:id', getUserById);

router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updateUser);
router.delete('/:id', authorizeRoles('ADMIN'), deleteUser);

module.exports = router;
