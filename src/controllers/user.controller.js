const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getAllUsers = async (req, res, next) => {
  try {
    const { role, department, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { userCode: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).populate('department', 'code name').sort({ createdAt: -1 });
    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', users);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('department', 'code name type');
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
    const { fullName, phone, title, department, role, isActive } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { fullName, phone, title, department, role, isActive },
      { new: true, runValidators: true }
    );

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
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return sendError(res, 'Không tìm thấy người dùng để xóa.', null, 404);
    }
    return sendSuccess(res, 'Xóa người dùng thành công.');
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
