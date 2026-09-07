const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getAllUsers = async (req, res, next) => {
  try {
    const { role, departmentId, isActive, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (departmentId) query.departmentId = departmentId;
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

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('departmentId', 'name type location');
    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404);
    }
    return sendSuccess(res, 'Lấy thông tin người dùng thành công.', user);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { fullName, departmentId, role, isActive, annualLeaveQuota } = req.body;
    const updateData = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (annualLeaveQuota !== undefined) updateData.annualLeaveQuota = annualLeaveQuota;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('departmentId', 'name type');

    if (!updatedUser) {
      return sendError(res, 'Không tìm thấy người dùng để cập nhật.', null, 404);
    }

    return sendSuccess(res, 'Cập nhật thông tin người dùng thành công.', updatedUser);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    // Soft delete bằng cách set isActive = false
    const softDeleted = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
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
  updateUser,
  deleteUser,
};
