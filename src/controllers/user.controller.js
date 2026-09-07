const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * @desc Lấy danh sách người dùng (Hỗ trợ lọc, tìm kiếm; Trưởng khoa chỉ xem thuộc khoa mình)
 * @route GET /api/v1/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, departmentId, isActive, search } = req.query;
    const query = {};

    // 1. Phân quyền dữ liệu theo phạm vi (Scope RBAC):
    // Trưởng khoa chỉ được phép xem danh sách nhân sự thuộc khoa của mình
    if (req.user.role === 'truongkhoa') {
      if (!req.user.departmentId) {
        return sendError(res, 'Tài khoản Trưởng khoa chưa được gán mã khoa trực thuộc.', null, 403);
      }
      query.departmentId = req.user.departmentId;
    } else if (departmentId) {
      // Admin có thể chỉ định lọc theo bất kỳ phòng ban nào
      query.departmentId = departmentId;
    }

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .populate('departmentId', 'name type')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', users);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Xem thông tin chi tiết một người dùng
 * @route GET /api/v1/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('departmentId', 'name type location');
    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404);
    }

    // Nếu là Trưởng khoa, kiểm tra người dùng được xem có thuộc khoa mình phụ trách hay không
    if (req.user.role === 'truongkhoa') {
      const userDeptId = user.departmentId?._id ? user.departmentId._id.toString() : user.departmentId?.toString();
      if (userDeptId !== req.user.departmentId) {
        return sendError(res, 'Bạn chỉ có quyền xem thông tin nhân sự thuộc khoa của mình.', null, 403);
      }
    }

    return sendSuccess(res, 'Lấy thông tin người dùng thành công.', user);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Thêm người dùng mới (Chỉ Admin)
 * @route POST /api/v1/users
 */
const createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role, departmentId, annualLeaveQuota } = req.body;

    if (!fullName || !email || !password || !departmentId) {
      return sendError(res, 'Vui lòng cung cấp đầy đủ họ tên, email, mật khẩu và departmentId.', null, 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
    }

    // Mã hóa mật khẩu bcrypt với cost 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      role: role || 'giangvien',
      departmentId,
      annualLeaveQuota: annualLeaveQuota !== undefined ? annualLeaveQuota : 12,
      isActive: true,
    });

    const populatedUser = await User.findById(newUser._id).populate('departmentId', 'name type');

    return sendSuccess(res, 'Tạo người dùng mới thành công.', populatedUser, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cập nhật thông tin người dùng
 * @route PUT /api/v1/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return sendError(res, 'Không tìm thấy người dùng để cập nhật.', null, 404);
    }

    const { fullName, departmentId, role, isActive, annualLeaveQuota } = req.body;
    const updateData = {};

    // Phân quyền cập nhật giữa Admin và Trưởng khoa:
    if (req.user.role === 'truongkhoa') {
      const targetDeptId = targetUser.departmentId ? targetUser.departmentId.toString() : null;
      if (targetDeptId !== req.user.departmentId) {
        return sendError(res, 'Bạn chỉ có quyền cập nhật nhân sự thuộc khoa của mình.', null, 403);
      }
      // Trưởng khoa chỉ được sửa thông tin cơ bản, không được tự ý đổi role, chuyển khoa hoặc kích hoạt/vô hiệu hóa
      if (fullName !== undefined) updateData.fullName = fullName;
      if (annualLeaveQuota !== undefined) updateData.annualLeaveQuota = annualLeaveQuota;
    } else {
      // Admin có toàn quyền sửa đổi
      if (fullName !== undefined) updateData.fullName = fullName;
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (annualLeaveQuota !== undefined) updateData.annualLeaveQuota = annualLeaveQuota;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate('departmentId', 'name type');

    return sendSuccess(res, 'Cập nhật thông tin người dùng thành công.', updatedUser);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Vô hiệu hóa tài khoản người dùng (Soft Delete: isActive = false) (Chỉ Admin)
 * @route DELETE /api/v1/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const softDeleted = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { returnDocument: 'after' }
    );
    if (!softDeleted) {
      return sendError(res, 'Không tìm thấy người dùng để xóa.', null, 404);
    }
    return sendSuccess(res, 'Vô hiệu hóa tài khoản người dùng thành công (soft delete).');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
