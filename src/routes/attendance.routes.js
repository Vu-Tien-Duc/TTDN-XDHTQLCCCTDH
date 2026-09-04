const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getAttendanceRecords } = require('../controllers/attendance.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Chấm công & Quản lý Điểm danh
 */

router.use(verifyToken);

/**
 * @swagger
 * /api/v1/attendance/check-in:
 *   post:
 *     summary: Thực hiện Chấm công Check-in
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduleId:
 *                 type: string
 *               method:
 *                 type: string
 *                 example: QR_CODE
 *     responses:
 *       201:
 *         description: Check-in thành công
 */
router.post('/check-in', checkIn);

/**
 * @swagger
 * /api/v1/attendance/check-out/{id}:
 *   post:
 *     summary: Thực hiện Chấm công Check-out
 *     tags: [Attendance]
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
 *         description: Check-out thành công
 */
router.post('/check-out/:id', checkOut);

/**
 * @swagger
 * /api/v1/attendance:
 *   get:
 *     summary: Xem lịch sử / thống kê chấm công
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lịch sử chấm công thành công
 */
router.get('/', getAttendanceRecords);

module.exports = router;
