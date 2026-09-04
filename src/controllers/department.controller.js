const Department = require('../models/department.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban thành công.', departments);
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const { code, name, description, type } = req.body;
    const existing = await Department.findOne({ code });

    if (existing) {
      return sendError(res, 'Mã phòng ban/khoa đã tồn tại.', null, 400);
    }

    const newDept = await Department.create({ code, name, description, type });
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
    });
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
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
