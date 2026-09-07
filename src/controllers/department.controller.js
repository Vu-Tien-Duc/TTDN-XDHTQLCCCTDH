const Department = require('../models/department.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

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

    const newDept = await Department.create({
      name,
      type,
      parentId: parentId || null,
      managerId: managerId || null,
      location: location || { lat: null, lng: null },
    });

    return sendSuccess(res, 'Tạo mới Khoa / Phòng ban thành công.', newDept, 201);
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const updatedDept = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role');

    if (!updatedDept) {
      return sendError(res, 'Không tìm thấy Khoa / Phòng ban.', null, 404);
    }
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
