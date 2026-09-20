const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/department.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Tất cả cán bộ/giảng viên đã đăng nhập đều có quyền tra cứu danh sách và chi tiết đơn vị
router.get('/tree', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), (req, res, next) => {
  req.query.tree = 'true';
  return getAllDepartments(req, res, next);
});
router.get('/', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getAllDepartments);
router.get('/:id', verifyRole(['admin', 'truongkhoa', 'giangvien', 'nhanvien']), getDepartmentById);

// Thao tác quản trị tổ chức (Chỉ Quản trị viên - Admin)
router.post('/', verifyRole(['admin']), createDepartment);
router.put('/:id', verifyRole(['admin']), updateDepartment);
router.delete('/:id', verifyRole(['admin']), deleteDepartment);

module.exports = router;
