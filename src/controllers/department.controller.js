const mongoose = require('mongoose');
const Department = require('../models/department.model');
const User = require('../models/user.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { runInTransaction } = require('../utils/transaction');

/**
 * Tự động đồng bộ vai trò (role) và khoa (departmentId) của người dùng khi được bổ nhiệm hoặc thôi chức
 * Chỉ can thiệp vào vai trò 'truongkhoa' khi đơn vị liên quan là 'khoa'.
 */
const syncDepartmentManager = async (deptId, newDeptType, newManagerId, oldManagerId = null, oldDeptType = null, session = null) => {
  // 1. Xử lý Trưởng đơn vị cũ (nếu có và đơn vị cũ là 'khoa' hoặc nay bị đổi khỏi 'khoa')
  const shouldCheckOldDean = (oldDeptType || newDeptType) === 'khoa';
  if (oldManagerId && shouldCheckOldDean && (!newManagerId || oldManagerId.toString() !== newManagerId.toString() || newDeptType !== 'khoa')) {
    const countQuery = Department.countDocuments({
      _id: { $ne: deptId },
      managerId: oldManagerId,
      type: 'khoa',
    });
    if (session) countQuery.session(session);
    const otherFacultyCount = await countQuery;

    if (otherFacultyCount === 0) {
      await User.findOneAndUpdate(
        { _id: oldManagerId, role: 'truongkhoa' },
        { role: 'giangvien' },
        session ? { session } : {}
      );
    }
  }

  // 2. Xử lý Trưởng đơn vị mới được chỉ định (chỉ nâng 'truongkhoa' nếu đơn vị là 'khoa')
  if (newManagerId) {
    const userQuery = User.findById(newManagerId);
    if (session) userQuery.session(session);
    const userToUpdate = await userQuery;

    if (userToUpdate) {
      const updates = {};
      if (newDeptType === 'khoa' && userToUpdate.role !== 'admin') {
        updates.role = 'truongkhoa';
        if (!userToUpdate.departmentId || userToUpdate.departmentId.toString() !== deptId.toString()) {
          updates.departmentId = deptId;
        }
      }
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(newManagerId, updates, session ? { session } : {});
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
 * - Khoa ('khoa'): Trực thuộc Trường/BGH (bắt buộc parentId = null). Không trực thuộc bất kỳ đơn vị nào.
 * - Phòng ban ('phongban'): Trực thuộc Trường/BGH (bắt buộc parentId = null). Không trực thuộc bất kỳ đơn vị nào.
 */
const validateDepartmentHierarchy = async (type, parentId, currentDeptId = null) => {
  if (type === 'khoa' || type === 'phongban') {
    if (parentId !== null && parentId !== undefined && parentId !== '') {
      return `${type === 'khoa' ? 'Khoa' : 'Phòng ban'} là đơn vị cấp trường, bắt buộc trực thuộc Ban Giám hiệu (parentId phải là null).`;
    }
    return null;
  }

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

  return 'Loại đơn vị không hợp lệ. Chỉ chấp nhận khoa, bomon hoặc phongban.';
};

/**
 * Kiểm tra tính hợp lệ và điều kiện bổ nhiệm của người quản lý (managerId):
 * - Phải tồn tại và đang active.
 * - Không cho phép tài khoản Admin làm Trưởng khoa hoặc người phụ trách đơn vị.
 * - Một người không thể cùng lúc làm Trưởng khoa của nhiều hơn 1 Khoa.
 * - Nếu đơn vị không phải là Khoa (phongban, bomon): Không cho phép người dùng đang có vai trò 'truongkhoa' làm phụ trách.
 */
const validateManagerEligibility = async (managerId, deptType, currentDeptId = null, session = null) => {
  if (!managerId) return null;

  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    return 'ID người quản lý (managerId) không đúng định dạng ObjectId.';
  }

  const userQuery = User.findById(managerId);
  if (session) userQuery.session(session);
  const manager = await userQuery;

  if (!manager) {
    return 'Người quản lý (managerId) không tồn tại trên hệ thống.';
  }

  if (!manager.isActive) {
    return 'Tài khoản của người quản lý đã bị vô hiệu hóa hoặc chưa được kích hoạt.';
  }

  if (manager.role === 'admin') {
    return 'Tài khoản Quản trị viên (Admin) không thể được bổ nhiệm làm Trưởng khoa hay người phụ trách đơn vị.';
  }

  if (deptType === 'khoa') {
    // Kiểm tra xem người này có đang là Trưởng khoa của một khoa khác không
    const filter = {
      managerId,
      type: 'khoa',
    };
    if (currentDeptId) {
      filter._id = { $ne: currentDeptId };
    }
    const checkOtherFaculty = Department.countDocuments(filter);
    if (session) checkOtherFaculty.session(session);
    const count = await checkOtherFaculty;
    if (count > 0) {
      return `Giảng viên "${manager.fullName}" hiện đã là Trưởng khoa của một Khoa khác. Một cán bộ không thể kiêm nhiệm Trưởng khoa của nhiều Khoa cùng lúc.`;
    }
  } else {
    // Đơn vị là bomon hoặc phongban: Không cho phép người đang có role truongkhoa làm phụ trách
    // Trừ khi họ đang trong quá trình chuyển giao
    if (manager.role === 'truongkhoa') {
      const checkFaculty = Department.countDocuments({
        managerId,
        type: 'khoa',
        ...(currentDeptId ? { _id: { $ne: currentDeptId } } : {}),
      });
      if (session) checkFaculty.session(session);
      const facultyCount = await checkFaculty;
      if (facultyCount > 0) {
        return `Người dùng "${manager.fullName}" đang là Trưởng khoa của một Khoa khác, không thể kiêm nhiệm phụ trách Phòng ban hoặc Bộ môn.`;
      }
    }
  }

  return null;
};

/**
 * Lấy danh sách phòng ban dạng cây phân cấp (Trường > Khoa > Bộ môn)
 * Bổ sung cơ chế tự bảo vệ: Set visited và giới hạn độ sâu (maxDepth) chống đệ quy vô hạn
 */
const buildDepartmentTree = (departments, parentId = null, visited = new Set(), depth = 0, maxDepth = 10) => {
  if (depth > maxDepth) {
    console.warn(
      `⚠️ [BUILD TREE WARNING]: Đã vượt quá độ sâu tối đa cho phép (${maxDepth}) tại nhánh parentId=${parentId}. Cây có thể có cấu trúc lồng sâu bất thường.`
    );
    return [];
  }
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
    const { type, parentId, tree = 'true', page, limit } = req.query;
    const query = {};

    if (type) query.type = type;
    if (parentId !== undefined) query.parentId = parentId === 'null' ? null : parentId;

    // Nếu yêu cầu cấu trúc cây phân cấp
    if (tree === 'true' && !type && parentId === undefined) {
      const departments = await Department.find(query)
        .populate('parentId', 'name type')
        .populate('managerId', 'fullName email role')
        .sort({ name: 1 })
        .lean();

      const treeData = buildDepartmentTree(departments);
      return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban dạng cây thành công.', treeData);
    }

    // Danh sách phẳng có hỗ trợ phân trang tùy chọn
    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      const skip = (pageNum - 1) * limitNum;

      const [departments, total] = await Promise.all([
        Department.find(query)
          .populate('parentId', 'name type')
          .populate('managerId', 'fullName email role')
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Department.countDocuments(query),
      ]);

      return sendSuccess(res, 'Lấy danh sách Khoa / Phòng ban thành công.', {
        departments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    // Lấy toàn bộ danh sách phẳng không phân trang (tương thích backward)
    const departments = await Department.find(query)
      .populate('parentId', 'name type')
      .populate('managerId', 'fullName email role')
      .sort({ name: 1 })
      .lean();

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

    const normalizedParentId = parentId === 'null' || parentId === '' || !parentId ? null : parentId;

    // 1. Kiểm tra trùng lặp tên đơn vị trong cùng cấp phân cấp (cùng parentId)
    const duplicateDept = await Department.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
      parentId: normalizedParentId,
    });
    if (duplicateDept) {
      return sendError(res, `Đơn vị mang tên "${trimmedName}" đã tồn tại trong cùng cấp phân cấp.`, null, 409);
    }

    // 2. Kiểm tra ràng buộc phân cấp cây tổ chức (Khoa/Phòng ban: parentId=null; Bộ môn: parentId=Khoa)
    const hierarchyError = await validateDepartmentHierarchy(type, normalizedParentId);
    if (hierarchyError) {
      return sendError(res, hierarchyError, null, 400);
    }

    // 3. Kiểm tra tính hợp lệ của người quản lý (managerId)
    const managerError = await validateManagerEligibility(managerId, type);
    if (managerError) {
      return sendError(res, managerError, null, 400);
    }

    let newDept = null;
    await runInTransaction(async (session) => {
      const createOptions = session ? { session } : {};
      const [created] = await Department.create(
        [
          {
            name: trimmedName,
            type,
            parentId: normalizedParentId,
            managerId: managerId || null,
            location: location || { lat: null, lng: null },
          },
        ],
        createOptions
      );
      newDept = created;

      // 4. Tự động đồng bộ vai trò Trưởng khoa và DepartmentId cho người phụ trách
      if (newDept.managerId) {
        await syncDepartmentManager(newDept._id, newDept.type, newDept.managerId, null, null, session);
      }
    });

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
    if (error.code === 11000) {
      return sendError(res, 'Đơn vị mang tên này đã tồn tại trong cùng cấp phân cấp tổ chức.', null, 409);
    }
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
        return sendError(res, `Đơn vị mang tên "${targetName}" đã tồn tại trong cùng cấp phân cấp.`, null, 409);
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

    // 5. Kiểm tra ràng buộc phân cấp: Khoa/Phòng ban (root), Bộ môn (thuộc Khoa)
    const hierarchyError = await validateDepartmentHierarchy(newType, newParentId, req.params.id);
    if (hierarchyError) {
      return sendError(res, hierarchyError, null, 400);
    }

    // 6. Xử lý managerId khi đổi loại đơn vị:
    // Nếu đổi từ Khoa sang Phòng ban hoặc Bộ môn và người dùng không chủ động truyền managerId mới:
    // Tự động clear managerId về null để tránh việc Department phi-khoa giữ Trưởng khoa
    let targetManagerId;
    if (req.body.managerId !== undefined) {
      targetManagerId = req.body.managerId === 'null' || req.body.managerId === '' ? null : req.body.managerId;
    } else if (existingDept.type === 'khoa' && newType !== 'khoa') {
      // Tự động giải phóng vị trí Trưởng khoa cũ khi đổi loại Khoa sang Phòng ban/Bộ môn
      targetManagerId = null;
    } else {
      targetManagerId = existingDept.managerId?._id || existingDept.managerId;
    }

    // 7. Kiểm tra tính hợp lệ của managerId nếu được chỉ định
    if (targetManagerId) {
      const managerError = await validateManagerEligibility(targetManagerId, newType, req.params.id);
      if (managerError) {
        return sendError(res, managerError, null, 400);
      }
    }

    const updatePayload = { ...req.body };
    if (req.body.name !== undefined) updatePayload.name = targetName;
    updatePayload.type = newType;
    updatePayload.parentId = newParentId;
    updatePayload.managerId = targetManagerId;

    const needsManagerSync = targetManagerId !== (existingDept.managerId?._id?.toString() || existingDept.managerId?.toString()) || newType !== existingDept.type;

    let updatedDept = null;
    await runInTransaction(async (session) => {
      const updateOptions = { new: true, runValidators: true };
      if (session) updateOptions.session = session;

      updatedDept = await Department.findByIdAndUpdate(req.params.id, updatePayload, updateOptions)
        .populate('parentId', 'name type')
        .populate('managerId', 'fullName email role');

      // 8. Tự động đồng bộ vai trò Trưởng khoa và DepartmentId khi có thay đổi người quản lý HOẶC thay đổi loại đơn vị
      if (needsManagerSync) {
        await syncDepartmentManager(
          updatedDept._id,
          updatedDept.type,
          targetManagerId,
          existingDept.managerId?._id || existingDept.managerId,
          existingDept.type,
          session
        );
      }
    });

    // 9. Ghi nhận Audit Log
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
    if (error.code === 11000) {
      return sendError(res, 'Đơn vị mang tên này đã tồn tại trong cùng cấp phân cấp tổ chức.', null, 409);
    }
    next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    let deletedDept = null;

    // Toàn bộ quy trình kiểm tra ràng buộc, xóa Department và hạ quyền Trưởng khoa cũ
    // được thực thi nguyên tử trong một Transaction để tránh bất đồng bộ dữ liệu.
    await runInTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Kiểm tra ràng buộc nếu còn nhân sự trực thuộc
      const userCount = await User.countDocuments({ departmentId: req.params.id }, queryOptions);
      if (userCount > 0) {
        const err = new Error(`Không thể xóa đơn vị vì đang có ${userCount} cán bộ/giảng viên trực thuộc.`);
        err.statusCode = 400;
        throw err;
      }

      // 2. Kiểm tra nếu có đơn vị con trực thuộc
      const childDeptCount = await Department.countDocuments({ parentId: req.params.id }, queryOptions);
      if (childDeptCount > 0) {
        const err = new Error(`Không thể xóa đơn vị vì đang có ${childDeptCount} bộ môn/đơn vị con trực thuộc.`);
        err.statusCode = 400;
        throw err;
      }

      deletedDept = await Department.findByIdAndDelete(req.params.id, queryOptions);
      if (!deletedDept) {
        const err = new Error('Không tìm thấy Khoa / Phòng ban.');
        err.statusCode = 404;
        throw err;
      }

      // 3. Nếu đơn vị bị xóa có Trưởng khoa, hạ quyền của họ về 'giangvien' nếu không quản lý khoa khác
      if (deletedDept.managerId && deletedDept.type === 'khoa') {
        const otherDeptCount = await Department.countDocuments(
          {
            _id: { $ne: deletedDept._id },
            managerId: deletedDept.managerId,
            type: 'khoa',
          },
          queryOptions
        );
        if (otherDeptCount === 0) {
          await User.findOneAndUpdate(
            { _id: deletedDept.managerId, role: 'truongkhoa' },
            { role: 'giangvien' },
            queryOptions
          );
        }
      }
    });

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
    if (error.statusCode) {
      return sendError(res, error.message, null, error.statusCode);
    }
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
