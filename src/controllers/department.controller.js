const mongoose = require('mongoose');
const Department = require('../models/department.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

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
 * Lấy danh sách phòng ban dạng cây phân cấp (Trường > Khoa > Bộ môn/Phòng ban)
 */
const buildDepartmentTree = (departments, parentId = null) => {
  const tree = [];
  for (const dept of departments) {
    const currentParentId = dept.parentId ? dept.parentId.toString() : null;
    const targetParentId = parentId ? parentId.toString() : null;

    if (currentParentId === targetParentId) {
      const children = buildDepartmentTree(departments, dept._id);
      const deptObj = dept.toObject ? dept.toObject() : dept;
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

    if (!['khoa', 'bomon', 'phongban'].includes(type)) {
      return sendError(res, 'Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.', null, 400);
    }

    // 1. Kiểm tra ràng buộc phân cấp: Trường > Khoa > Bộ môn
    if (type === 'bomon') {
      if (!parentId) {
        return sendError(res, 'Đơn vị loại Bộ môn bắt buộc phải thuộc một Khoa (parentId không được để trống).', null, 400);
      }
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return sendError(res, 'ID đơn vị cha (parentId) không đúng định dạng ObjectId.', null, 400);
      }
      const parentDept = await Department.findById(parentId);
      if (!parentDept) {
        return sendError(res, 'Đơn vị cha (parentId) không tồn tại trên hệ thống.', null, 400);
      }
      if (parentDept.type !== 'khoa') {
        return sendError(res, 'Bộ môn chỉ có thể trực thuộc một Khoa. Đơn vị cha được chọn không phải là Khoa.', null, 400);
      }
    } else if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return sendError(res, 'ID đơn vị cha (parentId) không đúng định dạng ObjectId.', null, 400);
      }
      const parentDept = await Department.findById(parentId);
      if (!parentDept) {
        return sendError(res, 'Đơn vị cha (parentId) không tồn tại trên hệ thống.', null, 400);
      }
      if (parentDept.type === 'bomon') {
        return sendError(res, `${type === 'khoa' ? 'Khoa' : 'Phòng ban'} không thể trực thuộc một Bộ môn.`, null, 400);
      }
    }

    // 2. Kiểm tra tính hợp lệ của managerId nếu được cung cấp
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
    }

    const newDept = await Department.create({
      name,
      type,
      parentId: parentId || null,
      managerId: managerId || null,
      location: location || { lat: null, lng: null },
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

    // Quyền hạn: Trưởng khoa chỉ được sửa đơn vị của khoa mình hoặc bộ môn con
    if (req.user.role === 'truongkhoa') {
      const isManagerOfThis = existingDept.managerId && existingDept.managerId.toString() === req.user.id;
      const isManagerOfParent = existingDept.parentId && (await Department.exists({ _id: existingDept.parentId, managerId: req.user.id }));
      const isSameDept = req.user.departmentId && (existingDept._id.toString() === req.user.departmentId || (existingDept.parentId && existingDept.parentId.toString() === req.user.departmentId));
      if (!isManagerOfThis && !isManagerOfParent && !isSameDept) {
        return sendError(res, 'Bạn chỉ có quyền cập nhật thông tin đơn vị trực thuộc khoa của mình.', null, 403);
      }
    }

    const newType = req.body.type !== undefined ? req.body.type : existingDept.type;
    const newParentId = req.body.parentId !== undefined 
      ? (req.body.parentId === 'null' || req.body.parentId === '' ? null : req.body.parentId) 
      : existingDept.parentId;
    const newManagerId = req.body.managerId !== undefined 
      ? (req.body.managerId === 'null' || req.body.managerId === '' ? null : req.body.managerId) 
      : undefined;

    // 1. Kiểm tra vòng lặp tham chiếu nếu cập nhật parentId
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

    // 2. Kiểm tra ràng buộc phân cấp: Trường > Khoa > Bộ môn
    if (newType === 'bomon') {
      if (!newParentId) {
        return sendError(res, 'Đơn vị loại Bộ môn bắt buộc phải thuộc một Khoa (parentId không được để trống).', null, 400);
      }
      const parentDept = await Department.findById(newParentId);
      if (!parentDept) {
        return sendError(res, 'Đơn vị cha (parentId) không tồn tại trên hệ thống.', null, 400);
      }
      if (parentDept.type !== 'khoa') {
        return sendError(res, 'Bộ môn chỉ có thể trực thuộc một Khoa. Đơn vị cha được chọn không phải là Khoa.', null, 400);
      }
    } else if (newParentId) {
      const parentDept = await Department.findById(newParentId);
      if (!parentDept) {
        return sendError(res, 'Đơn vị cha (parentId) không tồn tại trên hệ thống.', null, 400);
      }
      if (parentDept.type === 'bomon') {
        return sendError(res, `${newType === 'khoa' ? 'Khoa' : 'Phòng ban'} không thể trực thuộc một Bộ môn.`, null, 400);
      }
    }

    // 3. Kiểm tra tính hợp lệ của managerId nếu có cập nhật
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
    }

    const updatePayload = { ...req.body };
    if (req.body.parentId === 'null' || req.body.parentId === '') updatePayload.parentId = null;
    if (req.body.managerId === 'null' || req.body.managerId === '') updatePayload.managerId = null;

    const updatedDept = await Department.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    })
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role');

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
