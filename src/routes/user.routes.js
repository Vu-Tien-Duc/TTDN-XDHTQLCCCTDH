const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  registerFaceDescriptor,
  deleteFaceDescriptor,
} = require('../controllers/user.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

// Toàn bộ các thao tác người dùng đều yêu cầu đăng nhập
router.use(verifyToken);

// 1. Xem danh sách người dùng (Chỉ Admin và Trưởng khoa - Trưởng khoa tự động lọc theo khoa)
router.get('/', verifyRole(['admin', 'truongkhoa']), getAllUsers);

// 2. Thêm người dùng mới (Chỉ Admin)
router.post('/', verifyRole(['admin']), createUser);

// 3. Đăng ký & Xóa vector khuôn mặt Face ID (Chỉ Admin)
router.post('/:id/face-descriptor', verifyRole(['admin']), registerFaceDescriptor);
router.delete('/:id/face-descriptor', verifyRole(['admin']), deleteFaceDescriptor);

// 4. Xem chi tiết người dùng (Admin và Trưởng khoa của khoa đó)
router.get('/:id', verifyRole(['admin', 'truongkhoa']), getUserById);

// 5. Cập nhật thông tin người dùng (Admin hoặc Trưởng khoa)
router.put('/:id', verifyRole(['admin', 'truongkhoa']), updateUser);

// 6. Vô hiệu hóa người dùng (Soft Delete: isActive = false) (Chỉ Admin)
router.delete('/:id', verifyRole(['admin']), deleteUser);

module.exports = router;
