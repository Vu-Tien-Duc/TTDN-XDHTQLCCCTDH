const express = require('express');
const router = express.Router();
const {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/schedule.controller');
const { verifyToken, verifyRole, authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Schedules
 *   description: Quản lý lịch giảng dạy và công tác (Schedules)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Schedule:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "6a9d57378cf3a6165de25de0"
 *         userId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             fullName:
 *               type: string
 *               example: "TS. Trần Thị Bích"
 *             email:
 *               type: string
 *               example: "giangvien.bich@university.edu.vn"
 *             role:
 *               type: string
 *               example: "giangvien"
 *         shiftId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *               example: "Ca Sáng (Tiết 1 - 4)"
 *             startTime:
 *               type: string
 *               example: "07:00"
 *             endTime:
 *               type: string
 *               example: "11:30"
 *         startTime:
 *           type: string
 *           example: "07:00"
 *         endTime:
 *           type: string
 *           example: "11:30"
 *         roomId:
 *           type: string
 *           example: "Giảng đường A2-301"
 *         weekday:
 *           type: integer
 *           description: "0 (Chủ nhật) đến 6 (Thứ bảy)"
 *           example: 2
 *         isRecurring:
 *           type: boolean
 *           example: true
 *         startDate:
 *           type: string
 *           format: date
 *           example: "2026-01-15T00:00:00.000Z"
 *         endDate:
 *           type: string
 *           format: date
 *           example: "2026-12-31T23:59:59.000Z"
 *     CreateScheduleInput:
 *       type: object
 *       required:
 *         - userId
 *         - shiftId
 *         - weekday
 *         - startDate
 *         - endDate
 *       properties:
 *         userId:
 *           type: string
 *           description: ID của giảng viên / nhân viên
 *           example: "6a9fc77e257619f091fa0443"
 *         shiftId:
 *           type: string
 *           description: ID của ca làm việc áp dụng
 *           example: "6a9d57378cf3a6165de25ddc"
 *         startTime:
 *           type: string
 *           description: Tùy chọn, nếu để trống sẽ tự lấy từ ca làm việc
 *           example: "07:00"
 *         endTime:
 *           type: string
 *           description: Tùy chọn, nếu để trống sẽ tự lấy từ ca làm việc
 *           example: "11:30"
 *         roomId:
 *           type: string
 *           example: "Giảng đường B3-401"
 *         weekday:
 *           type: integer
 *           description: "0 (Chủ nhật) đến 6 (Thứ bảy)"
 *           example: 2
 *         isRecurring:
 *           type: boolean
 *           default: true
 *           example: true
 *         startDate:
 *           type: string
 *           format: date
 *           example: "2026-01-15T00:00:00.000Z"
 *         endDate:
 *           type: string
 *           format: date
 *           example: "2026-12-31T23:59:59.000Z"
 *     UpdateScheduleInput:
 *       type: object
 *       properties:
 *         roomId:
 *           type: string
 *           example: "Giảng đường B3-502"
 *         shiftId:
 *           type: string
 *           example: "6a9d57378cf3a6165de25ddc"
 *         startTime:
 *           type: string
 *           example: "07:30"
 *         endTime:
 *           type: string
 *           example: "11:45"
 *         weekday:
 *           type: integer
 *           example: 3
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 */

router.use(verifyToken);

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: Lấy danh sách lịch giảng dạy/công tác (Phân quyền theo role, hỗ trợ lọc theo học kỳ)
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo người dùng (Admin/Trưởng khoa)
 *       - in: query
 *         name: shiftId
 *         schema:
 *           type: string
 *         description: Lọc theo ca làm việc
 *       - in: query
 *         name: weekday
 *         schema:
 *           type: integer
 *         description: "Lọc theo thứ (0 = CN, 1 = T2, ..., 6 = T7)"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày bắt đầu học kỳ
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày kết thúc học kỳ
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Lọc lịch có hiệu lực vào ngày cụ thể (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Số trang (tùy chọn)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng mỗi trang (tùy chọn)
 *     responses:
 *       200:
 *         description: Lấy danh sách lịch thành công
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 */
router.get('/', getSchedules);

/**
 * @swagger
 * /api/schedules/{id}:
 *   get:
 *     summary: Lấy chi tiết một lịch giảng dạy/công tác theo ID
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch
 *     responses:
 *       200:
 *         description: Lấy chi tiết lịch thành công
 *       403:
 *         description: Không có quyền xem lịch của người khác
 *       404:
 *         description: Không tìm thấy lịch (SCHEDULE_001)
 */
router.get('/:id', getScheduleById);

/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: "[🔒 Admin / Trưởng khoa] Tạo mới lịch phân công (Bắt buộc startDate/endDate, validate chống trùng ca)"
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateScheduleInput'
 *     responses:
 *       201:
 *         description: Tạo lịch phân công thành công
 *       400:
 *         description: Thiếu trường bắt buộc hoặc ngày không hợp lệ (SCHEDULE_003)
 *       404:
 *         description: Ca làm việc chỉ định không tồn tại (SHIFT_001)
 *       409:
 *         description: Trùng lịch với ca khác trong cùng học kỳ (SCHEDULE_002)
 */
router.post('/', authorizeRoles('admin', 'truongkhoa'), createSchedule);

/**
 * @swagger
 * /api/schedules/{id}:
 *   put:
 *     summary: "[🔒 Admin / Trưởng khoa] Cập nhật thông tin lịch phân công (Đổi phòng, đổi ca, kiểm tra trùng lịch)"
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateScheduleInput'
 *     responses:
 *       200:
 *         description: Cập nhật lịch thành công
 *       400:
 *         description: Dữ liệu không hợp lệ (SCHEDULE_003)
 *       404:
 *         description: Không tìm thấy lịch (SCHEDULE_001)
 *       409:
 *         description: Trùng lịch khi thay đổi ca/thứ (SCHEDULE_002)
 */
router.put('/:id', authorizeRoles('admin', 'truongkhoa'), updateSchedule);

/**
 * @swagger
 * /api/schedules/{id}:
 *   delete:
 *     summary: "[🔒 Admin / Trưởng khoa] Xóa lịch phân công"
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch cần xóa
 *     responses:
 *       200:
 *         description: Xóa lịch thành công
 *       404:
 *         description: Không tìm thấy lịch để xóa (SCHEDULE_001)
 */
router.delete('/:id', authorizeRoles('admin', 'truongkhoa'), deleteSchedule);

module.exports = router;
