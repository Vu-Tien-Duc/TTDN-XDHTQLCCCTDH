const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ERROR_CODES = require('../utils/errorCodes');
const { euclideanDistance, FACE_MATCH_THRESHOLD, invalidateFaceCache } = require('../services/attendance.service');

const ADMIN_ROLE = 'admin';

const getDeanDepartmentIds = async (user) => {
  if (!user.departmentId) return [];
  const childIds = await Department.find({ parentId: user.departmentId }).distinct('_id');
  return [user.departmentId, ...childIds];
};

/**
 * @desc Lấy danh sách người dùng (Hỗ trợ lọc, tìm kiếm, phân trang; Trưởng khoa chỉ xem thuộc khoa mình)
 * @route GET /api/v1/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, departmentId, isActive, search, page, limit } = req.query;
    const query = {};

    // 1. Phân quyền dữ liệu theo phạm vi (Scope RBAC):
    if (req.user.role === 'truongkhoa') {
      if (!req.user.departmentId) {
        return sendError(res, 'Tài khoản Trưởng khoa chưa được gán mã khoa trực thuộc.', null, 403);
      }
      const departmentIds = await getDeanDepartmentIds(req.user);
      query.departmentId = { $in: departmentIds };
    } else if (departmentId) {
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

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const isPaginated = !isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0;

    const total = await User.countDocuments(query);
    const queryBuilder = User.find(query)
      .select('+faceDescriptor +faceDescriptors')
      .populate('departmentId', 'name type')
      .sort({ createdAt: -1 });

    if (isPaginated) {
      queryBuilder.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const users = await queryBuilder;

    const formattedUsers = users.map((u) => {
      const obj = u.toObject();
      obj.faceRegistered = Boolean(
        (Array.isArray(u.faceDescriptors) && u.faceDescriptors.length > 0) ||
        (Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128)
      );
      delete obj.faceDescriptor;
      delete obj.faceDescriptors;
      return obj;
    });

    if (isPaginated) {
      return sendSuccess(res, 'Lấy danh sách người dùng thành công.', {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        records: formattedUsers,
      });
    }

    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', formattedUsers);
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

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
    }

    const requestedRole = role || 'giangvien';
    if (requestedRole === ADMIN_ROLE) {
      return sendError(res, 'Không thể bổ nhiệm quyền Quản trị viên qua chức năng quản lý cán bộ.', null, 403);
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
      if (role === ADMIN_ROLE && targetUser.role !== ADMIN_ROLE) {
        return sendError(res, 'Không thể bổ nhiệm quyền Quản trị viên cho người dùng.', null, 403);
      }

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
    const softDeleted = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { returnDocument: 'after' }
    );
    if (!softDeleted) {
      return sendError(res, 'Không tìm thấy người dùng để xóa.', null, 404);
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
      },
    });

    return sendSuccess(res, 'Vô hiệu hóa tài khoản người dùng thành công (soft delete).');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Đăng ký vector khuôn mặt 128 chiều cho người dùng (Face ID)
 * @route POST /api/users/:id/face-descriptor
 * @access Admin only
 */
const registerFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { faceDescriptor, faceDescriptors } = req.body;
    let descriptorList = [];

    if (Array.isArray(faceDescriptors) && faceDescriptors.length > 0) {
      for (let idx = 0; idx < faceDescriptors.length; idx++) {
        const d = faceDescriptors[idx];
        if (!Array.isArray(d) || d.length !== 128) {
          return sendError(res, `Vector thứ ${idx + 1} trong faceDescriptors phải có đúng 128 số.`, null, 400);
        }
        if (!d.every((v) => typeof v === 'number' && !isNaN(v))) {
          return sendError(res, `Vector thứ ${idx + 1} chứa phần tử không phải số thực.`, null, 400);
        }
      }
      descriptorList = faceDescriptors;
    } else if (Array.isArray(faceDescriptor) && faceDescriptor.length === 128) {
      if (!faceDescriptor.every((v) => typeof v === 'number' && !isNaN(v))) {
        return sendError(res, 'Tất cả phần tử trong faceDescriptor phải là số thực hợp lệ.', null, 400);
      }
      descriptorList = [faceDescriptor];
    } else {
      return sendError(
        res,
        'Yêu cầu faceDescriptor (128 số) hoặc faceDescriptors (mảng các mẫu vector 128 số).',
        null,
        400
      );
    }

    // 2. Kiểm tra user tồn tại
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404, ERROR_CODES.USER_NOT_FOUND);
    }

    // 3. Kiểm tra tính độc nhất của khuôn mặt (Chống trùng lặp giữa các tài khoản)
    const otherUsersWithFace = await User.find({
      _id: { $ne: targetUser._id },
      isActive: true,
      $or: [
        { faceDescriptor: { $exists: true, $ne: null } },
        { faceDescriptors: { $exists: true, $not: { $size: 0 } } },
      ],
    }).select('+faceDescriptor +faceDescriptors fullName email role departmentId');

    let duplicateUser = null;
    let closestDistance = Infinity;

    for (const other of otherUsersWithFace) {
      const otherCandidates = [];
      if (Array.isArray(other.faceDescriptors) && other.faceDescriptors.length > 0) {
        otherCandidates.push(...other.faceDescriptors);
      } else if (Array.isArray(other.faceDescriptor) && other.faceDescriptor.length === 128) {
        otherCandidates.push(other.faceDescriptor);
      }

      for (const inputVec of descriptorList) {
        for (const existVec of otherCandidates) {
          const dist = euclideanDistance(inputVec, existVec);
          if (dist < closestDistance) closestDistance = dist;
          if (dist < FACE_MATCH_THRESHOLD) {
            duplicateUser = other;
            break;
          }
        }
        if (duplicateUser) break;
      }
      if (duplicateUser) break;
    }

    if (duplicateUser) {
      return sendError(
        res,
        `Khuôn mặt này đã được đăng ký cho tài khoản "${duplicateUser.fullName}" (${duplicateUser.email}). Mỗi tài khoản chỉ được sở hữu một khuôn mặt duy nhất trên hệ thống!`,
        {
          duplicateUserId: duplicateUser._id,
          duplicateFullName: duplicateUser.fullName,
          duplicateEmail: duplicateUser.email,
          distance: +closestDistance.toFixed(4),
          threshold: FACE_MATCH_THRESHOLD,
        },
        409,
        ERROR_CODES.USER_FACE_ALREADY_REGISTERED
      );
    }

    // 4. Lưu faceDescriptor & faceDescriptors đa góc
    targetUser.faceDescriptor = descriptorList[0];
    targetUser.faceDescriptors = descriptorList;
    await targetUser.save();

    // 5. Xóa RAM cache để kiosk nhận diện ngay mẫu mới
    invalidateFaceCache();

    // 6. Ghi AuditLog
    await AuditLog.create({
      actor: req.user.id,
      action: 'REGISTER_FACE_DESCRIPTOR',
      targetId: targetUser._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress,
      timestamp: new Date(),
      details: {
        targetEmail: targetUser.email,
        targetFullName: targetUser.fullName,
        samplesCount: descriptorList.length,
      },
    });

    return sendSuccess(res, 'Đăng ký vector khuôn mặt thành công.', {
      userId: targetUser._id,
      fullName: targetUser.fullName,
      email: targetUser.email,
      faceRegistered: true,
      samplesCount: descriptorList.length,
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Xóa vector khuôn mặt Face ID của người dùng
 * @route DELETE /api/users/:id/face-descriptor
 * @access Admin only
 */
const deleteFaceDescriptor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404, ERROR_CODES.USER_NOT_FOUND);
    }

    targetUser.faceDescriptor = undefined;
    targetUser.faceDescriptors = undefined;
    await targetUser.save();

    // Xóa RAM cache
    invalidateFaceCache();

    await AuditLog.create({
      actor: req.user.id,
      action: 'DELETE_FACE_DESCRIPTOR',
      targetId: targetUser._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress,
      timestamp: new Date(),
      details: {
        targetEmail: targetUser.email,
        targetFullName: targetUser.fullName,
      },
    });

    return sendSuccess(res, `Đã xóa dữ liệu Face ID của ${targetUser.fullName}.`, {
      userId: targetUser._id,
      fullName: targetUser.fullName,
      faceRegistered: false,
    }, 200);
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
  registerFaceDescriptor,
  deleteFaceDescriptor,
};
