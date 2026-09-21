const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ERROR_CODES = require('../utils/errorCodes');
const { euclideanDistance, FACE_MATCH_THRESHOLD, invalidateFaceCache } = require('../services/attendance.service');
const { getDeanDepartmentIds } = require('../utils/deanScope');
const { runInTransaction } = require('../utils/transaction');

const ADMIN_ROLE = 'admin';
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
      query.departmentId = {
        $in: departmentIds.map((id) => (typeof id === 'string' && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id)),
      };
    } else if (departmentId) {
      query.departmentId = typeof departmentId === 'string' && mongoose.isValidObjectId(departmentId)
        ? new mongoose.Types.ObjectId(departmentId)
        : departmentId;
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

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const isPaginated = !isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0;

    const total = await User.countDocuments(query);

    const pipeline = [
      { $match: query },
      { $sort: { createdAt: -1 } },
    ];

    if (isPaginated) {
      pipeline.push({ $skip: (pageNum - 1) * limitNum });
      pipeline.push({ $limit: limitNum });
    }

    // Tối ưu RAM: Tính cờ faceRegistered ngay trong MongoDB pipeline, không tải vector 128 số lên Node.js
    pipeline.push({
      $addFields: {
        faceRegistered: {
          $or: [
            { $gt: [{ $size: { $ifNull: ['$faceDescriptors', []] } }, 0] },
            { $gt: [{ $size: { $ifNull: ['$faceDescriptor', []] } }, 0] },
          ],
        },
      },
    });
    pipeline.push({
      $project: {
        passwordHash: 0,
        faceDescriptor: 0,
        faceDescriptors: 0,
      },
    });

    const rawUsers = await User.aggregate(pipeline);
    const populatedUsers = await User.populate(rawUsers, { path: 'departmentId', select: 'name type' });

    if (isPaginated) {
      return sendSuccess(res, 'Lấy danh sách người dùng thành công.', {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        records: populatedUsers,
      });
    }

    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', populatedUsers);
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

    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
      return sendError(res, 'Họ và tên phải có độ dài từ 2 đến 100 ký tự và không được chỉ chứa khoảng trắng.', null, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return sendError(res, 'Địa chỉ email không đúng định dạng.', null, 400);
    }

    if (typeof password !== 'string' || password.length < 6) {
      return sendError(res, 'Mật khẩu phải có ít nhất 6 ký tự.', null, 400);
    }

    if (annualLeaveQuota !== undefined) {
      const quotaNum = Number(annualLeaveQuota);
      if (!Number.isInteger(quotaNum) || quotaNum < 0 || quotaNum > 60) {
        return sendError(res, 'Số ngày phép năm phải là số nguyên từ 0 đến 60 ngày.', null, 400);
      }
    }

    const requestedRole = role || 'giangvien';
    const VALID_ROLES = ['admin', 'truongkhoa', 'giangvien', 'nhanvien'];
    if (!VALID_ROLES.includes(requestedRole)) {
      return sendError(res, `Vai trò không hợp lệ. Chỉ chấp nhận một trong các vai trò: ${VALID_ROLES.join(', ')}`, null, 400);
    }

    if (requestedRole === ADMIN_ROLE) {
      return sendError(res, 'Không thể bổ nhiệm quyền Quản trị viên qua chức năng quản lý cán bộ.', null, 403);
    }

    // Mã hóa mật khẩu bcrypt với cost 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await runInTransaction(async (session) => {
      const existingUser = await User.findOne({ email: normalizedEmail }).session(session);
      if (existingUser) {
        const err = new Error('Email đã tồn tại trên hệ thống.');
        err.statusCode = 400;
        throw err;
      }

      const dept = await Department.findById(departmentId).session(session);
      if (!dept) {
        const err = new Error('Khoa / Phòng ban chỉ định không tồn tại.');
        err.statusCode = 404;
        throw err;
      }

      if (requestedRole === 'truongkhoa' && dept.type !== 'khoa') {
        const err = new Error('Chức vụ Trưởng khoa chỉ áp dụng cho đơn vị là Khoa đào tạo, không áp dụng cho Bộ môn hoặc Phòng ban.');
        err.statusCode = 400;
        throw err;
      }

      const userDoc = new User({
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        role: requestedRole,
        departmentId,
        annualLeaveQuota: annualLeaveQuota !== undefined ? Number(annualLeaveQuota) : 12,
        isActive: true,
        isVerified: true,
      });
      await userDoc.save(session ? { session } : {});

      // Nếu tạo Trưởng khoa: đồng bộ Department.managerId
      if (requestedRole === 'truongkhoa') {
        if (dept.managerId && dept.managerId.toString() !== userDoc._id.toString()) {
          const oldManagerId = dept.managerId;
          const otherFaculties = await Department.countDocuments({
            managerId: oldManagerId,
            _id: { $ne: dept._id },
            type: 'khoa',
          }).session(session);
          if (otherFaculties === 0) {
            await User.updateOne(
              { _id: oldManagerId, role: 'truongkhoa' },
              { role: 'giangvien' },
              session ? { session } : {}
            );
          }
        }
        dept.managerId = userDoc._id;
        await dept.save(session ? { session } : {});
      }

      return userDoc;
    });

    const populatedUser = await User.findById(newUser._id).populate('departmentId', 'name type');

    // Ghi nhận Audit Log tự động khi tạo người dùng (Thao tác nhạy cảm của Admin)
    await AuditLog.create({
      actor: req.user.id,
      actorType: 'USER',
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
    if (error.code === 11000) {
      return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
    }
    if (error.statusCode) {
      return sendError(res, error.message, null, error.statusCode);
    }
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

    const { fullName, email, departmentId, role, isActive, annualLeaveQuota, avatar, phoneNumber } = req.body;
    const updateData = {};

    if (avatar !== undefined) updateData.avatar = avatar;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

    const isSelf = req.user.id === targetUser._id.toString();

    // 1. Validate fullName nếu được cung cấp
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
        return sendError(res, 'Họ và tên phải có độ dài từ 2 đến 100 ký tự và không được chỉ chứa khoảng trắng.', null, 400);
      }
      updateData.fullName = fullName.trim();
    }

    // 2. Validate email nếu được cung cấp
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return sendError(res, 'Địa chỉ email không đúng định dạng.', null, 400);
      }
      if (normalizedEmail !== targetUser.email) {
        const emailTaken = await User.findOne({ email: normalizedEmail, _id: { $ne: targetUser._id } });
        if (emailTaken) {
          return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
        }
        updateData.email = normalizedEmail;
      }
    }

    // 3. Validate annualLeaveQuota nếu được cung cấp
    if (annualLeaveQuota !== undefined) {
      const quotaNum = Number(annualLeaveQuota);
      if (!Number.isInteger(quotaNum) || quotaNum < 0 || quotaNum > 60) {
        return sendError(res, 'Số ngày phép năm phải là số nguyên từ 0 đến 60 ngày.', null, 400);
      }
      updateData.annualLeaveQuota = quotaNum;
    }

    // 4. Phân quyền cập nhật giữa Admin và Trưởng khoa:
    if (req.user.role === 'truongkhoa') {
      const targetDeptId = targetUser.departmentId ? targetUser.departmentId.toString() : null;
      const departmentIds = await getDeanDepartmentIds(req.user);
      if (!departmentIds.some((id) => id.toString() === targetDeptId)) {
        return sendError(res, 'Bạn chỉ có quyền cập nhật nhân sự thuộc khoa của mình.', null, 403);
      }
      // Trưởng khoa chỉ được sửa thông tin cơ bản (fullName, annualLeaveQuota)
      if (role !== undefined || departmentId !== undefined || isActive !== undefined || email !== undefined) {
        return sendError(res, 'Trưởng khoa không có quyền thay đổi vai trò, email, phòng ban hoặc trạng thái hoạt động của nhân sự.', null, 403);
      }
    } else {
      const VALID_ROLES = ['admin', 'truongkhoa', 'giangvien', 'nhanvien'];
      if (role !== undefined && !VALID_ROLES.includes(role)) {
        return sendError(res, `Vai trò không hợp lệ. Chỉ chấp nhận một trong các vai trò: ${VALID_ROLES.join(', ')}`, null, 400);
      }

      if (role === ADMIN_ROLE && targetUser.role !== ADMIN_ROLE) {
        return sendError(res, 'Không thể bổ nhiệm quyền Quản trị viên cho người dùng.', null, 403);
      }

      // Chặn Admin tự khóa tài khoản của chính mình
      if (isSelf && isActive !== undefined && (isActive === false || isActive === 'false')) {
        return sendError(res, 'Quản trị viên không thể tự khóa tài khoản của chính mình.', null, 400);
      }

      // Chặn Admin tự hạ quyền của chính mình
      if (isSelf && role !== undefined && role !== ADMIN_ROLE) {
        return sendError(res, 'Quản trị viên không thể tự hạ quyền của chính mình.', null, 400);
      }

      // Bảo vệ số lượng Admin tối thiểu (không hạ hoặc khóa Admin cuối cùng)
      const isDemotingAdmin = targetUser.role === ADMIN_ROLE && role !== undefined && role !== ADMIN_ROLE;
      const isDeactivatingAdmin = targetUser.role === ADMIN_ROLE && (isActive === false || isActive === 'false');
      if (isDemotingAdmin || isDeactivatingAdmin) {
        const activeAdminCount = await User.countDocuments({ role: ADMIN_ROLE, isActive: true });
        if (activeAdminCount <= 1) {
          return sendError(res, 'Không thể khóa hoặc hạ quyền Quản trị viên cuối cùng đang hoạt động trong hệ thống.', null, 400);
        }
      }

      if (departmentId !== undefined) {
        const deptExists = await Department.findById(departmentId);
        if (!deptExists) {
          return sendError(res, 'Khoa / Phòng ban chỉ định không tồn tại.', null, 404);
        }
        updateData.departmentId = departmentId;
      }

      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = (isActive === true || isActive === 'true');
    }

    const effectiveRole = updateData.role !== undefined ? updateData.role : targetUser.role;
    const effectiveDeptId = updateData.departmentId !== undefined ? updateData.departmentId : targetUser.departmentId;
    const effectiveIsActive = updateData.isActive !== undefined ? updateData.isActive : targetUser.isActive;
    const oldDeptIdStr = targetUser.departmentId ? targetUser.departmentId.toString() : null;
    const newDeptIdStr = effectiveDeptId ? effectiveDeptId.toString() : null;
    const deptChanged = newDeptIdStr !== oldDeptIdStr;

    // Thực thi cập nhật và đồng bộ Department trong Database Transaction
    const updatedUser = await runInTransaction(async (session) => {
      // Tình huống 1: Người dùng đang là Trưởng khoa nhưng bị đổi role khác hoặc bị vô hiệu hóa
      if (targetUser.role === 'truongkhoa' && (effectiveRole !== 'truongkhoa' || !effectiveIsActive)) {
        await Department.updateMany(
          { managerId: targetUser._id },
          { managerId: null },
          session ? { session } : {}
        );
      }

      // Tình huống 2: Người dùng là Trưởng khoa và bị điều chuyển sang khoa khác
      if (targetUser.role === 'truongkhoa' && effectiveRole === 'truongkhoa' && deptChanged) {
        // Gỡ managerId ở khoa cũ
        await Department.updateMany(
          { managerId: targetUser._id, _id: { $ne: effectiveDeptId } },
          { managerId: null },
          session ? { session } : {}
        );

        // Kiểm tra khoa mới phải là loại 'khoa'
        const newFaculty = await Department.findById(effectiveDeptId).session(session);
        if (!newFaculty) {
          const err = new Error('Khoa mới chỉ định không tồn tại.');
          err.statusCode = 404;
          throw err;
        }
        if (newFaculty.type !== 'khoa') {
          const err = new Error('Chức vụ Trưởng khoa chỉ áp dụng cho đơn vị là Khoa đào tạo, không áp dụng cho Bộ môn hoặc Phòng ban.');
          err.statusCode = 400;
          throw err;
        }

        // Nếu khoa mới đã có Trưởng khoa cũ khác
        if (newFaculty.managerId && newFaculty.managerId.toString() !== targetUser._id.toString()) {
          const oldMgrId = newFaculty.managerId;
          const otherFacs = await Department.countDocuments({
            managerId: oldMgrId,
            _id: { $ne: newFaculty._id },
            type: 'khoa',
          }).session(session);
          if (otherFacs === 0) {
            await User.updateOne(
              { _id: oldMgrId, role: 'truongkhoa' },
              { role: 'giangvien' },
              session ? { session } : {}
            );
          }
        }
        newFaculty.managerId = targetUser._id;
        await newFaculty.save(session ? { session } : {});
      }

      // Tình huống 3: Người dùng được thăng cấp hoặc bổ nhiệm mới thành Trưởng khoa
      if (targetUser.role !== 'truongkhoa' && effectiveRole === 'truongkhoa') {
        if (!effectiveIsActive) {
          const err = new Error('Không thể bổ nhiệm Trưởng khoa cho tài khoản đang bị vô hiệu hóa.');
          err.statusCode = 400;
          throw err;
        }

        const facultyDept = await Department.findById(effectiveDeptId).session(session);
        if (!facultyDept) {
          const err = new Error('Khoa chỉ định để bổ nhiệm Trưởng khoa không tồn tại.');
          err.statusCode = 404;
          throw err;
        }
        if (facultyDept.type !== 'khoa') {
          const err = new Error('Chức vụ Trưởng khoa chỉ áp dụng cho đơn vị là Khoa đào tạo, không áp dụng cho Bộ môn hoặc Phòng ban.');
          err.statusCode = 400;
          throw err;
        }

        if (facultyDept.managerId && facultyDept.managerId.toString() !== targetUser._id.toString()) {
          const oldManagerId = facultyDept.managerId;
          const otherFaculties = await Department.countDocuments({
            managerId: oldManagerId,
            _id: { $ne: facultyDept._id },
            type: 'khoa',
          }).session(session);
          if (otherFaculties === 0) {
            await User.updateOne(
              { _id: oldManagerId, role: 'truongkhoa' },
              { role: 'giangvien' },
              session ? { session } : {}
            );
          }
        }
        facultyDept.managerId = targetUser._id;
        await facultyDept.save(session ? { session } : {});
      }

      const resUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { returnDocument: 'after', runValidators: true, session: session || undefined }
      ).populate('departmentId', 'name type');

      return resUser;
    });

    // Ghi nhận Audit Log tự động khi cập nhật thông tin người dùng (Lưu vết before và after)
    const beforeState = {
      fullName: targetUser.fullName,
      email: targetUser.email,
      role: targetUser.role,
      departmentId: targetUser.departmentId,
      isActive: targetUser.isActive,
      annualLeaveQuota: targetUser.annualLeaveQuota,
    };

    const afterState = {
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      role: updatedUser.role,
      departmentId: updatedUser.departmentId?._id || updatedUser.departmentId,
      isActive: updatedUser.isActive,
      annualLeaveQuota: updatedUser.annualLeaveQuota,
    };

    await AuditLog.create({
      actor: req.user.id,
      actorType: 'USER',
      action: 'UPDATE_USER',
      targetId: updatedUser._id.toString(),
      targetType: 'User',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        updatedFields: Object.keys(updateData),
        before: beforeState,
        after: afterState,
      },
    });

    return sendSuccess(res, 'Cập nhật thông tin người dùng thành công.', updatedUser);
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'Email đã tồn tại trên hệ thống.', null, 400);
    }
    if (error.statusCode) {
      return sendError(res, error.message, null, error.statusCode);
    }
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

    const { softDeleted, managedDepts } = await runInTransaction(async (session) => {
      const depts = await Department.find({ managerId: targetUser._id }).session(session);
      if (depts.length > 0) {
        await Department.updateMany(
          { managerId: targetUser._id },
          { managerId: null },
          session ? { session } : {}
        );
      }

      const updated = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { returnDocument: 'after', session: session || undefined }
      );

      return { softDeleted: updated, managedDepts: depts };
    });

    // Ghi nhận Audit Log tự động khi vô hiệu hóa người dùng (Soft delete)
    await AuditLog.create({
      actor: req.user.id,
      actorType: 'USER',
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
