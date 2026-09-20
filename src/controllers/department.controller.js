const mongoose = require('mongoose');
const Department = require('../models/department.model');
const User = require('../models/user.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Tự động đồng bộ vai trò (role) và khoa (departmentId) của người dùng khi được bổ nhiệm hoặc thôi chức
 */
/**
 * Tự động đồng bộ vai trò (role) và khoa (departmentId) của người dùng khi được bổ nhiệm hoặc thôi chức
 * Chỉ can thiệp vào vai trò 'truongkhoa' khi đơn vị liên quan là 'khoa'.
 */
const syncDepartmentManager = async (deptId, newDeptType, newManagerId, oldManagerId = null, oldDeptType = null) => {
  // 1. Xử lý Trưởng đơn vị cũ (nếu có và đơn vị cũ là 'khoa' hoặc nay bị đổi khỏi 'khoa')
  const shouldCheckOldDean = (oldDeptType || newDeptType) === 'khoa';
  if (oldManagerId && shouldCheckOldDean && (!newManagerId || oldManagerId.toString() !== newManagerId.toString() || newDeptType !== 'khoa')) {
    const otherFacultyCount = await Department.countDocuments({
      _id: { $ne: deptId },
      managerId: oldManagerId,
      type: 'khoa',
    });
    if (otherFacultyCount === 0) {
      await User.findOneAndUpdate(
        { _id: oldManagerId, role: 'truongkhoa' },
        { role: 'giangvien' }
      );
    }
  }

  // 2. Xử lý Trưởng đơn vị mới được chỉ định (chỉ nâng 'truongkhoa' nếu đơn vị là 'khoa')
  if (newManagerId) {
    const userToUpdate = await User.findById(newManagerId);
    if (userToUpdate) {
      const updates = {};
      if (newDeptType === 'khoa' && userToUpdate.role !== 'admin') {
        updates.role = 'truongkhoa';
        if (!userToUpdate.departmentId || userToUpdate.departmentId.toString() !== deptId.toString()) {
          updates.departmentId = deptId;
        }
      }
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(newManagerId, updates);
      }
    }
  }
};

/**
 * Kiểm tra xem potentialAncestorId có phải là con/cháu của targetDeptId không (chống vòng lặp tham chiếu)
 */
const isDescendantOf = async (potentialAncestorId, targetDeptId) => {
  let currentId = potentialAncestorId;
  while (currentId) {
    if (currentId.toString() === targetDeptId.toString()) {
      return true;
    }
    const current = await Department.findById(currentId).select('parentId');
    currentId = current && current.parentId ? current.parentId : null;
  }
  return false;
};

/**
 * Kiểm tra ràng buộc phân cấp cây tổ chức theo quy chuẩn đại học:
 * - Bộ môn ('bomon'): Bắt buộc trực thuộc một Khoa đào tạo ('khoa'). Không được có con.
 * - Khoa ('khoa'): Trực thuộc Trường/BGH (parentId = null hoặc đơn vị cấp trường). Không trực thuộc Khoa khác hoặc Bộ môn.
 * - Phòng ban ('phongban'): Trực thuộc Trường/BGH (parentId = null). Không trực thuộc Khoa hoặc Bộ môn.
 */
const validateDepartmentHierarchy = async (type, parentId, currentDeptId = null) => {
  if (type === 'bomon') {
    if (!parentId) {
      return 'Đơn vị loại Bộ môn bắt buộc phải trực thuộc một Khoa đào tạo (parentId không được để trống).';
    }
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return 'ID đơn vị cha (parentId) không đúng định dạng ObjectId.';
    }
    const parentDept = await Department.findById(parentId);
    if (!parentDept) {
      return 'Khoa trực thuộc (parentId) không tồn tại trên hệ thống.';
    }
    if (parentDept.type !== 'khoa') {
      return 'Bộ môn chỉ có thể trực thuộc một Khoa đào tạo. Đơn vị cha được chọn không phải là Khoa.';
    }
    return null;
  }

  if (parentId) {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return 'ID đơn vị cha (parentId) không đúng định dạng ObjectId.';
    }
    const parentDept = await Department.findById(parentId);
    if (!parentDept) {
      return 'Đơn vị cha (parentId) không tồn tại trên hệ thống.';
    }
    if (parentDept.type === 'khoa') {
      return `${type === 'khoa' ? 'Khoa' : 'Phòng ban'} không thể trực thuộc một Khoa khác trong cơ cấu tổ chức.`;
    }
    if (parentDept.type === 'bomon') {
      return `${type === 'khoa' ? 'Khoa' : 'Phòng ban'} không thể trực thuộc một Bộ môn.`;
    }
  }
  return null;
};

/**
 * Lấy danh sách phòng ban dạng cây phân cấp (Trường > Khoa > Bộ môn/Phòng ban)
 * Bổ sung cơ chế tự bảo vệ: Set visited và giới hạn độ sâu (maxDepth) chống đệ quy vô hạn
 */
const buildDepartmentTree = (departments, parentId = null, visited = new Set(), depth = 0, maxDepth = 10) => {
  if (depth > maxDepth) return [];
  const tree = [];
  for (const dept of departments) {
    const deptIdStr = dept._id ? dept._id.toString() : null;
    if (!deptIdStr || visited.has(deptIdStr)) continue;

    const rawParent = dept.parentId;
    const currentParentId = rawParent
      ? (rawParent._id ? rawParent._id.toString() : rawParent.toString())
      : null;
    const targetParentId = parentId ? parentId.toString() : null;

    if (currentParentId === targetParentId) {
      visited.add(deptIdStr);
      const children = buildDepartmentTree(departments, dept._id, new Set(visited), depth + 1, maxDepth);
      const deptObj = dept.toObject ? dept.toObject() : { ...dept };
      if (children.length > 0) {
        deptObj.children = children;
      }
      tree.push(deptObj);
    }
  }
  return tree;
};

const getAllDepartments = async (req, res, next) => {
  try {
    const { type, parentId, tree = 'true' } = req.query;
    const query = {};

    if (type) query.type = type;
    if (parentId !== undefined) query.parentId = parentId === 'null' ? null : parentId;

    const departments = await Department.find(query)
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role')
      .sort({ name: 1 });

    if (tree === 'true' && !type && parentId === undefined) {
      const treeData = buildDepartmentTree(departments);
      return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban dạng cây thành công.', treeData);
    }

    return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban thành công.', departments);
  } catch (error) {
    next(error);
  }
};

const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role');

    if (!department) {
      return sendError(res, 'Không tìm thấy Khoa / Phòng ban.', null, 404);
    }
    return sendSuccess(res, 'Lấy thông tin Khoa / Phòng ban thành công.', department);
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name, type, parentId, managerId, location } = req.body;

    if (!name || !type) {
      return sendError(res, 'Tên và loại đơn vị (khoa, bomon, phongban) là bắt buộc.', null, 400);
    }

    if (typeof name !== 'string' || !name.trim()) {
      return sendError(res, 'Tên đơn vị phải là chuỗi ký tự hợp lệ và không được để trống.', null, 400);
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 150) {
      return sendError(res, 'Tên đơn vị không được vượt quá 150 ký tự.', null, 400);
    }

    if (!['khoa', 'bomon', 'phongban'].includes(type)) {
      return sendError(res, 'Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.', null, 400);
    }

    // 1. Kiểm tra trùng lặp tên đơn vị trong cùng cấp phân cấp (cùng parentId)
    const duplicateDept = await Department.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
      parentId: parentId || null,
    });
    if (duplicateDept) {
      return sendError(res, `Đơn vị mang tên "${trimmedName}" đã tồn tại trong cùng cấp phân cấp.`, null, 400);
    }

    // 2. Kiểm tra ràng buộc phân cấp cây tổ chức
    const hierarchyError = await validateDepartmentHierarchy(type, parentId);
    if (hierarchyError) {
      return sendError(res, hierarchyError, null, 400);
    }

    // 3. Kiểm tra tính hợp lệ của managerId nếu được cung cấp
    if (managerId) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return sendError(res, 'ID người quản lý (managerId) không đúng định dạng ObjectId.', null, 400);
      }
      const manager = await User.findById(managerId);
      if (!manager) {
        return sendError(res, 'Người quản lý (managerId) không tồn tại trên hệ thống.', null, 400);
      }
      if (!manager.isActive) {
        return sendError(res, 'Tài khoản của người quản lý đã bị vô hiệu hóa.', null, 400);
      }
      if (type === 'khoa' && manager.role === 'admin') {
        return sendError(res, 'Tài khoản Quản trị viên (Admin) không thể được bổ nhiệm làm Trưởng khoa.', null, 400);
      }
    }

    const newDept = await Department.create({
      name: trimmedName,
      type,
      parentId: parentId || null,
      managerId: managerId || null,
      location: location || { lat: null, lng: null },
    });

    // 4. Tự động đồng bộ vai trò Trưởng khoa và DepartmentId cho người phụ trách
    if (newDept.managerId) {
      await syncDepartmentManager(newDept._id, newDept.type, newDept.managerId, null);
    }

    // 5. Ghi nhận Audit Log
    await AuditLog.create({
      actor: req.user.id,
      action: 'CREATE_DEPARTMENT',
      targetId: newDept._id.toString(),
      targetType: 'Department',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        name: newDept.name,
        type: newDept.type,
        parentId: newDept.parentId,
        managerId: newDept.managerId,
      },
    });

    const populatedDept = await Department.findById(newDept._id)
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role');

    return sendSuccess(res, 'Tạo mới Khoa / Phòng ban thành công.', populatedDept, 201);
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const existingDept = await Department.findById(req.params.id);
    if (!existingDept) {
      return sendError(res, 'Không tìm thấy Khoa / Phòng ban.', null, 404);
    }



    const newType = req.body.type !== undefined ? req.body.type : existingDept.type;
    const newParentId = req.body.parentId !== undefined 
      ? (req.body.parentId === 'null' || req.body.parentId === '' ? null : req.body.parentId) 
      : existingDept.parentId;
    const newManagerId = req.body.managerId !== undefined 
      ? (req.body.managerId === 'null' || req.body.managerId === '' ? null : req.body.managerId) 
      : undefined;

    // 1. Kiểm tra tính hợp lệ của tên đơn vị nếu có cập nhật
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
        return sendError(res, 'Tên đơn vị phải là chuỗi ký tự hợp lệ và không được để trống.', null, 400);
      }
      if (req.body.name.trim().length > 150) {
        return sendError(res, 'Tên đơn vị không được vượt quá 150 ký tự.', null, 400);
      }
    }

    const targetName = req.body.name !== undefined ? req.body.name.trim() : existingDept.name;

    // 2. Chặn đổi loại làm hỏng các đơn vị con hiện tại
    if (newType !== existingDept.type) {
      if (!['khoa', 'bomon', 'phongban'].includes(newType)) {
        return sendError(res, 'Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.', null, 400);
      }
      const childCount = await Department.countDocuments({ parentId: req.params.id });
      if (existingDept.type === 'khoa' && newType !== 'khoa' && childCount > 0) {
        return sendError(
          res,
          `Không thể đổi loại Khoa này thành ${newType === 'bomon' ? 'Bộ môn' : 'Phòng ban'} vì đang có ${childCount} đơn vị con trực thuộc. Vui lòng di chuyển hoặc xử lý các đơn vị con trước.`,
          null,
          400
        );
      }
      if (newType === 'bomon' && childCount > 0) {
        return sendError(res, 'Đơn vị loại Bộ môn không được phép chứa đơn vị con.', null, 400);
      }
    }

    // 3. Kiểm tra trùng lặp tên đơn vị trong cùng cấp phân cấp nếu có đổi tên hoặc đổi đơn vị cha
    if (req.body.name !== undefined || req.body.parentId !== undefined) {
      const duplicateDept = await Department.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${targetName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
        parentId: newParentId !== undefined ? newParentId : existingDept.parentId,
      });
      if (duplicateDept) {
        return sendError(res, `Đơn vị mang tên "${targetName}" đã tồn tại trong cùng cấp phân cấp.`, null, 400);
      }
    }

    // 4. Kiểm tra vòng lặp tham chiếu nếu cập nhật parentId
    if (newParentId) {
      if (!mongoose.Types.ObjectId.isValid(newParentId)) {
        return sendError(res, 'ID đơn vị cha (parentId) không đúng định dạng ObjectId.', null, 400);
      }
      if (newParentId.toString() === req.params.id) {
        return sendError(res, 'Đơn vị không thể nhận chính mình làm đơn vị cha.', null, 400);
      }
      const isCircular = await isDescendantOf(newParentId, req.params.id);
      if (isCircular) {
        return sendError(res, 'Không thể chọn đơn vị con/cháu làm đơn vị cha (lỗi lặp vòng tham chiếu).', null, 400);
      }
    }

    // 5. Kiểm tra ràng buộc phân cấp: Trường > Khoa > Bộ môn
    const hierarchyError = await validateDepartmentHierarchy(newType, newParentId, req.params.id);
    if (hierarchyError) {
      return sendError(res, hierarchyError, null, 400);
    }

    // 6. Kiểm tra tính hợp lệ của managerId nếu có cập nhật
    if (newManagerId) {
      if (!mongoose.Types.ObjectId.isValid(newManagerId)) {
        return sendError(res, 'ID người quản lý (managerId) không đúng định dạng ObjectId.', null, 400);
      }
      const manager = await User.findById(newManagerId);
      if (!manager) {
        return sendError(res, 'Người quản lý (managerId) không tồn tại trên hệ thống.', null, 400);
      }
      if (!manager.isActive) {
        return sendError(res, 'Tài khoản của người quản lý đã bị vô hiệu hóa.', null, 400);
      }
      if (newType === 'khoa' && manager.role === 'admin') {
        return sendError(res, 'Tài khoản Quản trị viên (Admin) không thể được bổ nhiệm làm Trưởng khoa.', null, 400);
      }
    }

    const updatePayload = { ...req.body };
    if (req.body.name !== undefined) updatePayload.name = targetName;
    if (req.body.parentId === 'null' || req.body.parentId === '') updatePayload.parentId = null;
    if (req.body.managerId === 'null' || req.body.managerId === '') updatePayload.managerId = null;

    const updatedDept = await Department.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    })
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role');

    // 7. Tự động đồng bộ vai trò Trưởng khoa và DepartmentId khi có thay đổi người quản lý HOẶC thay đổi loại đơn vị
    const targetManagerId = newManagerId !== undefined ? newManagerId : (updatedDept.managerId?._id || updatedDept.managerId);
    if (newManagerId !== undefined || newType !== existingDept.type) {
      await syncDepartmentManager(
        updatedDept._id,
        updatedDept.type,
        targetManagerId,
        existingDept.managerId?._id || existingDept.managerId,
        existingDept.type
      );
    }

    // 6. Ghi nhận Audit Log
    await AuditLog.create({
      actor: req.user.id,
      action: 'UPDATE_DEPARTMENT',
      targetId: updatedDept._id.toString(),
      targetType: 'Department',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        name: updatedDept.name,
        type: updatedDept.type,
        parentId: updatedDept.parentId,
        managerId: updatedDept.managerId,
      },
    });

    return sendSuccess(res, 'Cập nhật Khoa / Phòng ban thành công.', updatedDept);
  } catch (error) {
    next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    // 1. Kiểm tra ràng buộc nếu còn nhân sự trực thuộc
    const userCount = await User.countDocuments({ departmentId: req.params.id });
    if (userCount > 0) {
      return sendError(
        res,
        `Không thể xóa đơn vị vì đang có ${userCount} cán bộ/giảng viên trực thuộc.`,
        null,
        400
      );
    }

    // 2. Kiểm tra nếu có đơn vị con
    const childDeptCount = await Department.countDocuments({ parentId: req.params.id });
    if (childDeptCount > 0) {
      return sendError(
        res,
        `Không thể xóa đơn vị vì đang có ${childDeptCount} bộ môn/đơn vị con trực thuộc.`,
        null,
        400
      );
    }

    const deletedDept = await Department.findByIdAndDelete(req.params.id);
    if (!deletedDept) {
      return sendError(res, 'Không tìm thấy Khoa / Phòng ban.', null, 404);
    }

    // 3. Nếu đơn vị bị xóa có Trưởng khoa, hạ quyền của họ về 'giangvien' nếu không quản lý khoa khác
    if (deletedDept.managerId && deletedDept.type === 'khoa') {
      const otherDeptCount = await Department.countDocuments({
        managerId: deletedDept.managerId,
        type: 'khoa',
      });
      if (otherDeptCount === 0) {
        await User.findOneAndUpdate(
          { _id: deletedDept.managerId, role: 'truongkhoa' },
          { role: 'giangvien' }
        );
      }
    }

    // 4. Ghi nhận Audit Log
    await AuditLog.create({
      actor: req.user.id,
      action: 'DELETE_DEPARTMENT',
      targetId: deletedDept._id.toString(),
      targetType: 'Department',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
      details: {
        name: deletedDept.name,
        type: deletedDept.type,
      },
    });

    return sendSuccess(res, 'Xóa Khoa / Phòng ban thành công.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
