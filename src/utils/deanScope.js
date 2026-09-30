const User = require('../models/user.model');
const Department = require('../models/department.model');

/**
 * Lấy danh sách ID phòng ban thuộc phạm vi quản lý của Trưởng khoa (gồm Khoa và các Bộ môn con)
 * @param {Object} actor - User object (req.user hoặc instance User)
 * @returns {Promise<Array<string|ObjectId>>} Danh sách departmentId
 */
const getDeanDepartmentIds = async (actor) => {
  if (!actor) return [];
  if (actor.role !== 'truongkhoa') return [];

  const myDeptId = actor.departmentId || (await User.findById(actor.id || actor._id))?.departmentId;
  if (!myDeptId) return [];

  // Đệ quy đa cấp (BFS) tìm toàn bộ phòng ban con, cháu, chắt trong cây phân cấp
  const allDeptIds = [myDeptId];
  let currentParentIds = [myDeptId];

  while (currentParentIds.length > 0) {
    const childDepts = await Department.find({ parentId: { $in: currentParentIds } }).distinct('_id');
    if (!childDepts || childDepts.length === 0) break;
    allDeptIds.push(...childDepts);
    currentParentIds = childDepts;
  }

  return allDeptIds;
};

/**
 * Lấy danh sách User ID thuộc phạm vi quản lý của Trưởng khoa (toàn bộ nhân sự trong Khoa & Bộ môn con)
 * @param {Object} actor - User object (req.user hoặc instance User)
 * @returns {Promise<Array<string>>} Mảng chuỗi ID người dùng
 */
const getDeanScopedUserIds = async (actor) => {
  if (!actor || actor.role !== 'truongkhoa') return [];
  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return [];

  const users = await User.find({ departmentId: { $in: departmentIds } }).select('_id');
  return users.map((u) => u._id.toString());
};

/**
 * Kiểm tra xem một user mục tiêu có nằm trong phạm vi quản lý của Trưởng khoa hay không
 * @param {Object} actor - User thực hiện (req.user)
 * @param {string|ObjectId} targetUserId - ID của user cần kiểm tra
 * @returns {Promise<boolean>} true nếu hợp lệ hoặc actor là admin
 */
const isUserInDeanScope = async (actor, targetUserId) => {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'truongkhoa') return false;
  if (!targetUserId) return false;

  const departmentIds = await getDeanDepartmentIds(actor);
  if (!departmentIds.length) return false;

  const targetUser = await User.findById(targetUserId).select('departmentId');
  if (!targetUser || !targetUser.departmentId) return false;

  return departmentIds.some((id) => id.toString() === targetUser.departmentId.toString());
};

module.exports = {
  getDeanDepartmentIds,
  getDeanScopedUserIds,
  isUserInDeanScope,
};
