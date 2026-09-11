const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getAttendanceById,
  updateAttendanceByAdmin,
} = require('../controllers/attendance.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Quản lý và xử lý chấm công tự động cho Giảng viên & Nhân viên
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckInInput:
 *       type: object
 *       properties:
 *         shiftId:
 *           type: string
 *           example: "6a9d57378cf3a6165de25ddc"
 *           description: ID ca làm việc (dành cho Check-in thủ công chỉ định ca)
 *         method:
 *           type: string
 *           enum: [manual, face, qr, gps, fingerprint]
 *           default: manual
 *           example: qr
 *           description: Phương thức xác thực điểm danh
 *         deviceId:
 *           type: string
 *           example: "KIOSK_GATE_A2"
 *           description: Mã định danh thiết bị chấm công
 *         location:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *               example: 21.028511
 *             lng:
 *               type: number
 *               example: 105.854167
 *           description: Tọa độ GPS của người dùng tại thời điểm điểm danh
 *     AdminUpdateAttendanceInput:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [ON_TIME, LATE, EARLY_LEAVE, ABSENT, EXCUSED_ABSENCE]
 *           example: ON_TIME
 *           description: Trạng thái chấm công cần điều chỉnh
 *         checkInTime:
 *           type: string
 *           format: date-time
 *           example: "2026-09-11T07:05:00.000Z"
 *           description: Mốc thời gian check-in mới
 *         checkOutTime:
 *           type: string
 *           format: date-time
 *           example: "2026-09-11T11:30:00.000Z"
 *           description: Mốc thời gian check-out mới
 *         leaveRequestId:
 *           type: string
 *           example: "6a9d57378cf3a6165de25df5"
 *           description: ID đơn xin nghỉ phép/dạy bù liên kết (nếu có)
 *     AttendanceLogResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "6a9d57378cf3a6165de25deb"
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
 *         scheduleId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             roomId:
 *               type: string
 *               example: "Giảng đường A2-301"
 *             weekday:
 *               type: integer
 *               example: 2
 *         checkInTime:
 *           type: string
 *           format: date-time
 *         checkOutTime:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [ON_TIME, LATE, EARLY_LEAVE, ABSENT, EXCUSED_ABSENCE]
 *           example: "ON_TIME"
 *         method:
 *           type: string
 *           example: "qr"
 *         isManualOverride:
 *           type: boolean
 *           example: false
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Mô tả chi tiết lỗi."
 *         errorCode:
 *           type: string
 *           example: "ATTENDANCE_004"
 */

router.use(verifyToken);

/**
 * @swagger
 * /api/attendance/check-in:
 *   post:
 *     summary: Chấm công Check-in (Tự động nhận diện ca & lịch giảng dạy hiệu lực)
 *     description: Lấy userId từ JWT. Client chỉ cần gửi method, deviceId, location. Backend tự động quy đổi giờ Asia/Ho_Chi_Minh (UTC+7), tìm lịch dạy khớp hôm nay trong khung [startTime - 30p, endTime] và đánh giá ON_TIME hoặc LATE.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckInInput'
 *     responses:
 *       201:
 *         description: Chấm công Check-in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Chấm công Check-in thành công."
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceLogResponse'
 *       400:
 *         description: Không tìm thấy ca làm việc/lịch công tác phù hợp thời điểm hiện tại (Mã ATTENDANCE_004)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Chưa xác thực hoặc Token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Đã check-in cho ca này hôm nay rồi (Mã ATTENDANCE_002)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/check-in', checkIn);

/**
 * @swagger
 * /api/attendance/check-out:
 *   post:
 *     summary: Chấm công Check-out & Tự động đánh giá về sớm (EARLY_LEAVE)
 *     description: Tự động tìm bản ghi Check-in đang mở trong ngày hôm nay theo giờ UTC+7. So khớp với endTime của ca; nếu ra sớm và ban đầu là ON_TIME thì chuyển sang EARLY_LEAVE (nếu ban đầu đã LATE thì giữ nguyên). Trả về workingDuration thực tế.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example: {}
 *     responses:
 *       200:
 *         description: Chấm công Check-out thành công kèm thời lượng làm việc thực tế
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Chấm công Check-out thành công."
 *                 data:
 *                   type: object
 *                   properties:
 *                     workingDuration:
 *                       type: object
 *                       properties:
 *                         totalMinutes:
 *                           type: integer
 *                           example: 210
 *                         formatted:
 *                           type: string
 *                           example: "3 giờ 30 phút"
 *                     earlyLeave:
 *                       type: object
 *                       properties:
 *                         isEarlyLeave:
 *                           type: boolean
 *                           example: false
 *                         earlyMinutes:
 *                           type: integer
 *                           example: 0
 *       401:
 *         description: Chưa xác thực hoặc Token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy bản ghi check-in nào còn mở trong ngày hôm nay (Mã ATTENDANCE_003)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/check-out', checkOut);

/**
 * @swagger
 * /api/attendance/history:
 *   get:
 *     summary: Tra cứu lịch sử chấm công (Phân quyền 4 cấp & Phân trang)
 *     description: Giảng viên/Nhân viên chỉ xem của chính mình. Trưởng khoa tự động lọc theo khoa mình (departmentId). Admin xem toàn trường và lọc theo userId, departmentId, status, from, to.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo ID nhân sự (Chỉ Admin hoặc Trưởng khoa lọc người trong khoa)
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Lọc theo ID khoa/phòng ban (Dành cho Admin)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ON_TIME, LATE, EARLY_LEAVE, ABSENT, EXCUSED_ABSENCE]
 *         description: Lọc theo trạng thái chấm công
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-01-01"
 *         description: Từ ngày (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-12-31"
 *         description: Đến ngày (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang số hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số bản ghi trên mỗi trang
 *     responses:
 *       200:
 *         description: Lấy lịch sử chấm công thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy lịch sử chấm công thành công."
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     records:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AttendanceLogResponse'
 *       401:
 *         description: Chưa xác thực hoặc Token không hợp lệ
 *       403:
 *         description: Trưởng khoa cố tình truy vấn nhân sự ngoài khoa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/history', getAttendanceHistory);

/**
 * @swagger
 * /api/attendance/{id}:
 *   get:
 *     summary: Xem chi tiết một bản ghi chấm công
 *     description: Kiểm tra phân quyền truy cập. Giảng viên chỉ xem được bản ghi của mình, Trưởng khoa xem của khoa mình, Admin xem toàn bộ.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID bản ghi chấm công (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Lấy chi tiết chấm công thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy chi tiết chấm công thành công."
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceLogResponse'
 *       400:
 *         description: Định dạng ID không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc Token không hợp lệ
 *       403:
 *         description: Không có quyền xem bản ghi của người khác
 *       404:
 *         description: Không tìm thấy bản ghi chấm công
 */
router.get('/:id', getAttendanceById);

/**
 * @swagger
 * /api/attendance/{id}:
 *   put:
 *     summary: Admin điều chỉnh log chấm công (Manual Override & Ghi Audit Log)
 *     description: Chỉ Admin có quyền can thiệp. Bắt buộc hệ thống tự động gán isManualOverride = true và method = 'admin_override'. Tự động lưu vết dữ liệu trước và sau khi sửa vào Collection audit_logs.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID bản ghi chấm công cần điều chỉnh
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUpdateAttendanceInput'
 *     responses:
 *       200:
 *         description: Admin điều chỉnh bản ghi chấm công thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Admin điều chỉnh bản ghi chấm công thành công."
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedLog:
 *                       $ref: '#/components/schemas/AttendanceLogResponse'
 *                     previousData:
 *                       type: object
 *       400:
 *         description: Định dạng ID không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc Token không hợp lệ
 *       403:
 *         description: Quyền truy cập bị từ chối (Không phải Admin)
 *       404:
 *         description: Không tìm thấy bản ghi chấm công
 */
router.put('/:id', authorizeRoles('admin'), updateAttendanceByAdmin);

module.exports = router;
