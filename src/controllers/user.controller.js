const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { getDeanDepartmentIds } = require('../utils/deanScope');

const ADMIN_ROLE = 'admin';

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
      const departmentIds = await getDeanDepartmentIds(req.user);
      query.departmentId = { $in: departmentIds };
    } else if (departmentId) {
      // Admin có thể chỉ định lọc theo bất kỳ phòng ban nào
      query.departmentId = departmentId;
    }

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      // Escape ký tự đặc biệt phòng chống Regex DoS (ReDoS)
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    // Hỗ trợ phân trang linh hoạt, giữ tương thích ngược nếu không truyền page/limit
    const { page, limit } = req.query;
    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        User.find(query)
          .populate('departmentId', 'name type')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        User.countDocuments(query),
      ]);

      return sendSuccess(res, 'Lấy danh sách người dùng thành công.', {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        data: users,
      });
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
      const departmentIds = await getDeanDepartmentIds(req.user);
      if (!departmentIds.some((id) => id.toString() === userDeptId)) {
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

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
    }

    // Kiểm tra tính tồn tại của phòng ban
    const dept = await Department.findById(departmentId);
    if (!dept) {
      return sendError(res, 'Khoa / Phòng ban chỉ định không tồn tại.', null, 404);
    }

    const requestedRole = role || 'giangvien';
    const VALID_ROLES = ['admin', 'truongkhoa', 'giangvien', 'nhanvien'];
    if (!VALID_ROLES.includes(requestedRole)) {
      return sendError(res, `Vai trò không hợp lệ. Chỉ chấp nhận một trong các vai trò: ${VALID_ROLES.join(', ')}`, null, 400);
    }

    if (requestedRole === ADMIN_ROLE) {
      return sendError(res, 'Không thể bổ nhiệm quyền Quản trị viên qua chức năng quản lý cán bộ.', null, 403);
    }

    if (requestedRole === 'truongkhoa' && dept.type !== 'khoa') {
      return sendError(res, 'Chức vụ Trưởng khoa chỉ áp dụng cho đơn vị là Khoa đào tạo, không áp dụng cho Bộ môn hoặc Phòng ban.', null, 400);
    }

    // Mã hóa mật khẩu bcrypt với cost 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      role: requestedRole,
      departmentId,
      annualLeaveQuota: annualLeaveQuota !== undefined ? annualLeaveQuota : 12,
      isActive: true,
      isVerified: true,
    });

    const populatedUser = await User.findById(newUser._id).populate('departmentId', 'name type');

    // Ghi nhận Audit Log tự động khi tạo người dùng (Thao tác nhạy cảm của Admin)
    await AuditLog.create({
      actor: req.user.id,
      action: 'CREATE_USER',
      targetId: newUser._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        departmentId: newUser.departmentId,
      },
    });

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

    const isSelf = req.user.id === targetUser._id.toString();

    // Phân quyền cập nhật giữa Admin và Trưởng khoa:
    if (req.user.role === 'truongkhoa') {
      const targetDeptId = targetUser.departmentId ? targetUser.departmentId.toString() : null;
      const departmentIds = await getDeanDepartmentIds(req.user);
      if (!departmentIds.some((id) => id.toString() === targetDeptId)) {
        return sendError(res, 'Bạn chỉ có quyền cập nhật nhân sự thuộc khoa của mình.', null, 403);
      }
      // Trưởng khoa chỉ được sửa thông tin cơ bản (fullName, annualLeaveQuota)
      // Nếu gửi các trường ngoài phạm vi -> trả về 403 Forbidden
      if (role !== undefined || departmentId !== undefined || isActive !== undefined) {
        return sendError(res, 'Trưởng khoa không có quyền thay đổi vai trò, phòng ban hoặc trạng thái hoạt động của nhân sự.', null, 403);
      }
      if (fullName !== undefined) updateData.fullName = fullName;
      if (annualLeaveQuota !== undefined) updateData.annualLeaveQuota = annualLeaveQuota;
    } else {
      const VALID_ROLES = ['admin', 'truongkhoa', 'giangvien', 'nhanvien'];
      if (role !== undefined && !VALID_ROLES.includes(role)) {
        return sendError(res, `Vai trò không hợp lệ. Chỉ chấp nhận một trong các vai trò: ${VALID_ROLES.join(', ')}`, null, 400);
      }

      if (role === ADMIN_ROLE && targetUser.role !== ADMIN_ROLE) {
        return sendError(res, 'Không thể bổ nhiệm quyền Quản trị viên cho người dùng.', null, 403);
      }

      // 1. Chặn Admin tự khóa tài khoản của chính mình
      if (isSelf && isActive !== undefined && (isActive === false || isActive === 'false')) {
        return sendError(res, 'Quản trị viên không thể tự khóa tài khoản của chính mình.', null, 400);
      }

      // 2. Chặn Admin tự hạ quyền của chính mình
      if (isSelf && role !== undefined && role !== ADMIN_ROLE) {
        return sendError(res, 'Quản trị viên không thể tự hạ quyền của chính mình.', null, 400);
      }

      // 3. Bảo vệ số lượng Admin tối thiểu (không hạ hoặc khóa Admin cuối cùng)
      const isDemotingAdmin = targetUser.role === ADMIN_ROLE && role !== undefined && role !== ADMIN_ROLE;
      const isDeactivatingAdmin = targetUser.role === ADMIN_ROLE && (isActive === false || isActive === 'false');
      if (isDemotingAdmin || isDeactivatingAdmin) {
        const activeAdminCount = await User.countDocuments({ role: ADMIN_ROLE, isActive: true });
        if (activeAdminCount <= 1) {
          return sendError(res, 'Không thể khóa hoặc hạ quyền Quản trị viên cuối cùng đang hoạt động trong hệ thống.', null, 400);
        }
      }

      // 4. Kiểm tra sự tồn tại của phòng ban nếu được cập nhật
      if (departmentId !== undefined) {
        const deptExists = await Department.findById(departmentId);
        if (!deptExists) {
          return sendError(res, 'Khoa / Phòng ban chỉ định không tồn tại.', null, 404);
        }
      }

      // 5. Kiểm tra tính hợp lệ khi bổ nhiệm Trưởng khoa
      if (role === 'truongkhoa') {
        const targetDeptId = departmentId || targetUser.departmentId;
        const facultyDept = await Department.findById(targetDeptId);
        if (!facultyDept) {
          return sendError(res, 'Khoa chỉ định để bổ nhiệm Trưởng khoa không tồn tại.', null, 404);
        }
        if (facultyDept.type !== 'khoa') {
          return sendError(res, 'Chức vụ Trưởng khoa chỉ áp dụng cho đơn vị là Khoa đào tạo, không áp dụng cho Bộ môn hoặc Phòng ban.', null, 400);
        }

        const willBeActive = isActive !== undefined ? (isActive === true || isActive === 'true') : targetUser.isActive;
        if (!willBeActive) {
          return sendError(res, 'Không thể bổ nhiệm Trưởng khoa cho tài khoản đang bị vô hiệu hóa.', null, 400);
        }

        // Nếu khoa này đang do người khác phụ trách, tự động gỡ Trưởng khoa cũ
        if (facultyDept.managerId && facultyDept.managerId.toString() !== targetUser._id.toString()) {
          const oldManagerId = facultyDept.managerId;
          const otherFaculties = await Department.countDocuments({
            managerId: oldManagerId,
            _id: { $ne: facultyDept._id },
            type: 'khoa',
          });
          if (otherFaculties === 0) {
            await User.updateOne({ _id: oldManagerId, role: 'truongkhoa' }, { role: 'giangvien' });
          }
        }
        facultyDept.managerId = targetUser._id;
        await facultyDept.save();
      }

      // Admin có toàn quyền sửa đổi các trường hợp lệ
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

    // Đồng bộ chức vụ Trưởng khoa khi bị giáng chức:
    if (role !== undefined && role !== 'truongkhoa' && targetUser.role === 'truongkhoa') {
      await Department.updateMany({ managerId: targetUser._id }, { managerId: null });
    }

    // Ghi nhận Audit Log tự động khi cập nhật thông tin người dùng
    await AuditLog.create({
      actor: req.user.id,
      action: 'UPDATE_USER',
      targetId: updatedUser._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: updateData,
    });

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
    if (req.params.id === req.user.id) {
      return sendError(res, 'Quản trị viên không thể tự xóa hoặc vô hiệu hóa tài khoản của chính mình.', null, 400);
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return sendError(res, 'Không tìm thấy người dùng để xóa.', null, 404);
    }

    // Bảo vệ số lượng Admin tối thiểu
    if (targetUser.role === ADMIN_ROLE) {
      const activeAdminCount = await User.countDocuments({ role: ADMIN_ROLE, isActive: true });
      if (activeAdminCount <= 1) {
        return sendError(res, 'Không thể vô hiệu hóa Quản trị viên cuối cùng đang hoạt động trong hệ thống.', null, 400);
      }
    }

    const softDeleted = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { returnDocument: 'after' }
    );

    // Nếu người dùng này đang là Trưởng đơn vị của Khoa/Bộ môn, tự động gỡ để tránh giữ tài khoản bị vô hiệu hóa
    const managedDepts = await Department.find({ managerId: softDeleted._id });
    if (managedDepts.length > 0) {
      await Department.updateMany({ managerId: softDeleted._id }, { managerId: null });
    }

    // Ghi nhận Audit Log tự động khi vô hiệu hóa người dùng (Soft delete)
    await AuditLog.create({
      actor: req.user.id,
      action: 'DELETE_USER',
      targetId: softDeleted._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        email: softDeleted.email,
        fullName: softDeleted.fullName,
        isActive: false,
        vacatedDepartments: managedDepts.map((d) => ({ id: d._id, name: d.name })),
      },
    });

    const warningNotice = managedDepts.length > 0
      ? ` Đồng thời đã tự động miễn nhiệm chức vụ Trưởng đơn vị tại: ${managedDepts.map((d) => d.name).join(', ')}.`
      : '';

    return sendSuccess(res, `Vô hiệu hóa tài khoản người dùng thành công (soft delete).${warningNotice}`);
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
