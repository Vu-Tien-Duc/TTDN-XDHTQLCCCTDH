const express = require('express');
const router = express.Router();
const {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
} = require('../controllers/shiftConfig.controller');
const { verifyToken, verifyRole, authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Shifts
 *   description: Quản lý cấu hình ca làm việc chuẩn (Shift Configs)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ShiftConfig:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "6a9d57378cf3a6165de25ddc"
 *         name:
 *           type: string
 *           example: "Ca Sáng (Tiết 1 - 4)"
 *         startTime:
 *           type: string
 *           example: "07:00"
 *         endTime:
 *           type: string
 *           example: "11:30"
 *         lateThresholdMinutes:
 *           type: integer
 *           example: 15
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateShiftInput:
 *       type: object
 *       required:
 *         - name
 *         - startTime
 *         - endTime
 *       properties:
 *         name:
 *           type: string
 *           example: "Ca Chiều Muộn (Tiết 7 - 9)"
 *         startTime:
 *           type: string
 *           example: "15:00"
 *         endTime:
 *           type: string
 *           example: "18:00"
 *         lateThresholdMinutes:
 *           type: integer
 *           default: 15
 *           example: 15
 *     UpdateShiftInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Ca Chiều Nâng Cao"
 *         startTime:
 *           type: string
 *           example: "13:30"
 *         endTime:
 *           type: string
 *           example: "17:45"
 *         lateThresholdMinutes:
 *           type: integer
 *           example: 20
 */

router.use(verifyToken);

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: Lấy danh sách tất cả các ca làm việc chuẩn
 *     tags: [Shifts]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách ca làm việc thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShiftConfig'
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách ca làm việc thành công."
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 */
router.get('/', getAllShiftConfigs);

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một ca làm việc theo ID
 *     tags: [Shifts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của ca làm việc
 *     responses:
 *       200:
 *         description: Lấy chi tiết ca làm việc thành công
 *       404:
 *         description: Không tìm thấy ca làm việc (SHIFT_001)
 */
router.get('/:id', getShiftConfigById);

/**
 * @swagger
 * /api/shifts:
 *   post:
 *     summary: "[🔒 Admin] Tạo mới một ca làm việc chuẩn"
 *     tags: [Shifts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShiftInput'
 *     responses:
 *       201:
 *         description: Tạo mới ca làm việc thành công
 *       400:
 *         description: Dữ liệu ca làm việc không hợp lệ (SHIFT_003)
 *       403:
 *         description: Không có quyền truy cập (chỉ Admin)
 *       409:
 *         description: Ca làm việc đã tồn tại (SHIFT_004)
 */
router.post('/', authorizeRoles('admin'), createShiftConfig);

/**
 * @swagger
 * /api/shifts/{id}:
 *   put:
 *     summary: "[🔒 Admin] Cập nhật thông tin ca làm việc"
 *     tags: [Shifts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của ca làm việc cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateShiftInput'
 *     responses:
 *       200:
 *         description: Cập nhật ca làm việc thành công
 *       400:
 *         description: Dữ liệu không hợp lệ (SHIFT_003)
 *       404:
 *         description: Không tìm thấy ca làm việc (SHIFT_001)
 *       409:
 *         description: Tên ca bị trùng với ca khác (SHIFT_004)
 */
router.put('/:id', authorizeRoles('admin'), updateShiftConfig);

/**
 * @swagger
 * /api/shifts/{id}:
 *   delete:
 *     summary: "[🔒 Admin] Xóa ca làm việc (Chặn xóa nếu có lịch đang tham chiếu)"
 *     tags: [Shifts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của ca làm việc cần xóa
 *     responses:
 *       200:
 *         description: Xóa ca làm việc thành công
 *       400:
 *         description: Ca đang được sử dụng trong lịch, không thể xóa (SHIFT_002)
 *       404:
 *         description: Không tìm thấy ca làm việc (SHIFT_001)
 */
router.delete('/:id', authorizeRoles('admin'), deleteShiftConfig);

module.exports = router;
