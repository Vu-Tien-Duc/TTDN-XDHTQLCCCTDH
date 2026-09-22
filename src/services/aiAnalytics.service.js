const mongoose = require('mongoose');
const User = require('../models/user.model');
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const Schedule = require('../models/schedule.model');
const Department = require('../models/department.model');
const ShiftConfig = require('../models/shiftConfig.model');
const { buildAttendanceDateFilter } = require('./attendance.service');
const { parseVietnameseDateRange, getVietnamParts, createVietnamDate } = require('../utils/aiDateParser');

/**
 * ============================================================================
 * 1. QUẢN LÝ PHÂN QUYỀN VÀ PHẠM VI TRUY VẤN (AUTHORIZATION SCOPE)
 * ============================================================================
 */

/**
 * Lấy danh sách departmentId mà Trưởng khoa có quyền quản lý (gồm khoa và các bộ môn con)
 * @param {string} departmentId
 * @returns {Promise<string[]>}
 */
const getDepartmentScopeIds = async (departmentId) => {
  if (!departmentId) return [];
  const children = await Department.find({ parentId: departmentId }).select('_id');
  const allIds = [departmentId.toString(), ...children.map((c) => c._id.toString())];
  return allIds;
};

/**
 * Kiểm tra xem currentUser có quyền truy cập dữ liệu của targetUserId hay không
 * @param {Object} currentUser
 * @param {string|Object} targetUserId
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
const checkUserPermission = async (currentUser, targetUserId) => {
  if (!currentUser) {
    return { allowed: false, reason: 'Chưa xác thực người dùng.' };
  }

  const tid = targetUserId ? (targetUserId._id ? targetUserId._id.toString() : targetUserId.toString()) : null;

  // 1. Quản trị viên (Admin): Toàn quyền truy cập mọi người dùng
  if (currentUser.role === 'admin') {
    return { allowed: true };
  }

  // 2. Tra cứu dữ liệu của chính mình: Luôn được phép
  if (tid && tid === currentUser.id.toString()) {
    return { allowed: true };
  }

  // 3. Giảng viên / Nhân viên: Chỉ được xem chính mình
  if (currentUser.role === 'giangvien' || currentUser.role === 'nhanvien') {
    return {
      allowed: false,
      reason: 'Bạn chỉ có quyền tra cứu thông tin của chính mình, không có quyền xem thông tin của cán bộ/giảng viên khác.',
    };
  }

  // 4. Trưởng khoa: Chỉ được xem cán bộ/giảng viên thuộc khoa hoặc bộ môn trực thuộc
  if (currentUser.role === 'truongkhoa') {
    if (!tid) return { allowed: true };
    const myDeptId = currentUser.departmentId;
    if (!myDeptId) {
      return { allowed: false, reason: 'Tài khoản Trưởng khoa chưa được gán mã khoa trực thuộc.' };
    }
    const scopedDeptIds = await getDepartmentScopeIds(myDeptId);
    const targetUser = await User.findById(tid).select('departmentId');
    if (!targetUser) {
      return { allowed: false, reason: 'Không tìm thấy người dùng được yêu cầu.' };
    }
    const targetDeptId = targetUser.departmentId ? targetUser.departmentId.toString() : null;
    if (!targetDeptId || !scopedDeptIds.includes(targetDeptId)) {
      return {
        allowed: false,
        reason: 'Bạn chỉ có quyền xem dữ liệu của cán bộ/giảng viên thuộc khoa/bộ môn trực thuộc quản lý của mình.',
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Bạn không có quyền thực hiện tra cứu này.' };
};

/**
 * Kiểm tra xem currentUser có quyền truy cập phạm vi departmentId hay không
 * @param {Object} currentUser
 * @param {string} departmentId
 * @returns {Promise<{ allowed: boolean, reason?: string, effectiveDeptIds?: string[] }>}
 */
const checkDepartmentPermission = async (currentUser, departmentId) => {
  if (!currentUser) {
    return { allowed: false, reason: 'Chưa xác thực người dùng.' };
  }

  // Admin có quyền tra cứu toàn trường
  if (currentUser.role === 'admin') {
    if (departmentId) {
      const scoped = await getDepartmentScopeIds(departmentId);
      return { allowed: true, effectiveDeptIds: scoped };
    }
    return { allowed: true, effectiveDeptIds: null };
  }

  // Giảng viên / Nhân viên không có quyền xem thống kê toàn khoa
  if (currentUser.role === 'giangvien' || currentUser.role === 'nhanvien') {
    return {
      allowed: false,
      reason: 'Bạn không có quyền xem thống kê cấp khoa hoặc toàn hệ thống. Bạn chỉ có thể tra cứu thông tin cá nhân.',
    };
  }

  // Trưởng khoa chỉ xem được khoa của mình
  if (currentUser.role === 'truongkhoa') {
    const myDeptId = currentUser.departmentId;
    if (!myDeptId) {
      return { allowed: false, reason: 'Tài khoản Trưởng khoa chưa được gán mã khoa trực thuộc.' };
    }
    const allowedDepts = await getDepartmentScopeIds(myDeptId);
    if (departmentId && !allowedDepts.includes(departmentId.toString())) {
      return {
        allowed: false,
        reason: 'Bạn chỉ có quyền tra cứu thống kê thuộc khoa hoặc bộ môn trực thuộc quản lý của mình.',
      };
    }
    return { allowed: true, effectiveDeptIds: departmentId ? [departmentId.toString()] : allowedDepts };
  }

  return { allowed: false, reason: 'Không có quyền truy cập.' };
};

/**
 * ============================================================================
 * 2. PHÂN GIẢI THỰC THỂ (ENTITY RESOLUTION: USER & DEPARTMENT)
 * ============================================================================
 */

/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu và ký tự thừa để so khớp gần đúng
 * @param {string} str
 * @returns {string}
 */
const normalizeVietnameseString = (str = '') => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Bóc tách tên người từ câu hỏi và tìm kiếm trong CSDL
 * Xử lý: "thầy", "cô", "giảng viên", "TS.", "ThS.", "PGS.", "PGS. TS.", "tôi", "mình", "em"
 * @param {string} text
 * @param {Object} currentUser
 * @returns {Promise<{
 *   isSelf?: boolean,
 *   notFound?: boolean,
 *   isAmbiguous?: boolean,
 *   user?: Object,
 *   matches?: Array,
 *   queryName?: string,
 *   error?: string
 * }>}
 */
const resolveUser = async (text = '', currentUser = null) => {
  const cleanText = text.trim();
  const lower = cleanText.toLowerCase();

  // 1. Nhận diện đại từ xưng hô chỉ chính người hỏi: "tôi", "mình", "bản thân tôi", "của tôi"
  const selfPatterns = [
    /\btôi\b/i,
    /\bmình\b/i,
    /\bbản thân\b/i,
    /\bcủa tôi\b/i,
    /\blịch dạy của tôi\b/i,
    /\bchấm công của tôi\b/i,
    /\bđơn của tôi\b/i,
  ];
  for (const pattern of selfPatterns) {
    if (pattern.test(cleanText)) {
      if (!currentUser) return { notFound: true, queryName: 'Tôi' };
      const selfUser = await User.findById(currentUser.id).populate('departmentId', 'name');
      return { isSelf: true, user: selfUser };
    }
  }

  // 2. Tìm tên riêng người dùng trong câu hỏi
  // Xóa bỏ các từ tiền tố xưng hô
  const cleanForSearch = cleanText
    .replace(/(?:giảng viên|cán bộ|nhân viên|thầy giáo|cô giáo|thầy|cô|bác|anh|chị)\s+/gi, '')
    .replace(/(?:pgs\.\s*ts\.|pgs\.|gs\.\s*ts\.|gs\.|ts\.|ths\.|cn\.)\s*/gi, '');

  // Lấy toàn bộ người dùng đang hoạt động để so khớp danh tính
  const allUsers = await User.find({ isActive: true }).populate('departmentId', 'name');

  const matches = [];
  const normalizedQuery = normalizeVietnameseString(cleanText);

  for (const u of allUsers) {
    // Tên đầy đủ trong DB: ví dụ "TS. Trần Thị Bích (Giảng viên KTPM)"
    // Bóc tách tên cốt lõi bỏ danh xưng và bỏ phần trong ngoặc
    const rawCoreName = u.fullName
      .replace(/\(.*?\)/g, '')
      .replace(/(?:pgs\.\s*ts\.|pgs\.|gs\.\s*ts\.|gs\.|ts\.|ths\.|cn\.)\s*/gi, '')
      .trim();

    const normFullName = normalizeVietnameseString(u.fullName);
    const normCoreName = normalizeVietnameseString(rawCoreName);

    // Kiểm tra xem tên cốt lõi có xuất hiện trong câu hỏi không
    // Ví dụ normCoreName: "tran thi bich", normalizedQuery có chứa "tran thi bich"
    if (normCoreName && normalizedQuery.includes(normCoreName)) {
      matches.push(u);
      continue;
    }

    // Hoặc kiểm tra dạng "cô Bích", "thầy Cường": họ và tên đệm có thể viết tắt hoặc chỉ gọi tên
    // Lấy từ cuối cùng (tên chính)
    const nameWords = rawCoreName.split(' ');
    const firstName = nameWords[nameWords.length - 1]; // "Bích"
    const normFirstName = normalizeVietnameseString(firstName);

    // Nếu câu hỏi có dạng "thầy [Tên]" hoặc "cô [Tên]" hoặc "giảng viên [Tên]"
    const titleRegex = new RegExp(`(?:thay|co|giang vien|ts|ths)\\s+${normFirstName}\\b`, 'i');
    if (normFirstName && titleRegex.test(normalizedQuery)) {
      if (!matches.some((m) => m._id.toString() === u._id.toString())) {
        matches.push(u);
      }
    }
  }

  if (matches.length === 0) {
    return { notFound: true, queryName: cleanText };
  }

  if (matches.length > 1) {
    // Nếu có nhiều người trùng tên, kiểm tra xem có khớp chính xác tuyệt đối tên ai không
    const exactMatches = matches.filter((u) => {
      const rawCore = u.fullName.replace(/\(.*?\)/g, '').replace(/(?:pgs\.\s*ts\.|pgs\.|gs\.\s*ts\.|gs\.|ts\.|ths\.|cn\.)\s*/gi, '').trim();
      return normalizeVietnameseString(cleanText).includes(normalizeVietnameseString(rawCore));
    });

    if (exactMatches.length === 1) {
      return { user: exactMatches[0] };
    }

    // Trường hợp trùng nhiều người: Trả về yêu cầu chọn người cụ thể theo yêu cầu mục V & XV
    return {
      isAmbiguous: true,
      matches: matches.map((m) => ({
        id: m._id,
        fullName: m.fullName,
        email: m.email,
        role: m.role,
        departmentName: m.departmentId?.name || 'Chưa gán',
      })),
    };
  }

  return { user: matches[0] };
};

/**
 * Phân giải Khoa / Phòng ban từ câu hỏi
 * @param {string} text
 * @param {Object} currentUser
 * @returns {Promise<Object|null>}
 */
const resolveDepartment = async (text = '', currentUser = null) => {
  const lower = (text || '').toLowerCase();
  const allDepts = await Department.find();

  // Keyword maps cho các đơn vị thông dụng
  const aliases = [
    { keys: ['cntt', 'công nghệ thông tin', 'chuyển đổi số', 'tin học'], deptMatch: (d) => d.name.toLowerCase().includes('cntt') || d.name.toLowerCase().includes('thông tin') },
    { keys: ['kinh tế', 'qtkd', 'quản trị kinh doanh'], deptMatch: (d) => d.name.toLowerCase().includes('kinh tế') },
    { keys: ['hàn', 'nhật', 'ngôn ngữ'], deptMatch: (d) => d.name.toLowerCase().includes('ngôn ngữ') || d.name.toLowerCase().includes('hàn') },
    { keys: ['mỹ thuật', 'đồ họa', 'thiết kế'], deptMatch: (d) => d.name.toLowerCase().includes('thiết kế') || d.name.toLowerCase().includes('mỹ thuật') },
    { keys: ['đào tạo', 'phòng đào tạo'], deptMatch: (d) => d.name.toLowerCase().includes('đào tạo') },
    { keys: ['hành chính', 'tổng hợp', 'hc-th'], deptMatch: (d) => d.name.toLowerCase().includes('hành chính') },
    { keys: ['công tác sinh viên', 'ctsv'], deptMatch: (d) => d.name.toLowerCase().includes('sinh viên') },
    { keys: ['khảo thí', 'đảm bảo chất lượng', 'đbcl'], deptMatch: (d) => d.name.toLowerCase().includes('khảo thí') },
  ];

  for (const alias of aliases) {
    if (alias.keys.some((k) => lower.includes(k))) {
      const match = allDepts.find(alias.deptMatch);
      if (match) return match;
    }
  }

  for (const d of allDepts) {
    if (lower.includes(d.name.toLowerCase())) {
      return d;
    }
  }

  // Nếu câu hỏi nói về "khoa", "bộ môn" hoặc người dùng là Trưởng khoa đang hỏi trong khoa của mình
  if (
    lower.includes('khoa') ||
    lower.includes('bộ môn') ||
    lower.includes('bo mon') ||
    (currentUser && currentUser.role === 'truongkhoa')
  ) {
    if (currentUser?.departmentId) {
      const myDept = allDepts.find(
        (d) => d._id.toString() === currentUser.departmentId.toString()
      );
      if (myDept) return myDept;
    }
  }

  return null;
};

/**
 * ============================================================================
 * 3. ANALYTICS ENGINE: ATTENDANCE (CHẤM CÔNG)
 * ============================================================================
 */

/**
 * Lấy tổng hợp chấm công theo phạm vi (người dùng hoặc khoa/phòng ban hoặc toàn trường)
 * @param {Object} params { userId, departmentId, fromDate, toDate, currentUser }
 * @returns {Promise<Object>}
 */
const getAttendanceSummary = async ({ userId, departmentId, fromDate, toDate, currentUser }) => {
  let effectiveDeptId = departmentId;

  // Nếu Trưởng khoa tra cứu phạm vi khoa mà không chỉ định cụ thể -> Tự động lấy khoa trực thuộc
  if (!userId && !effectiveDeptId && currentUser?.role === 'truongkhoa' && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  // 1. Kiểm tra phân quyền
  if (userId) {
    const perm = await checkUserPermission(currentUser, userId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else if (effectiveDeptId) {
    const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else {
    // Không truyền userId hay departmentId -> Muốn xem toàn trường
    if (currentUser && currentUser.role !== 'admin') {
      return {
        unauthorized: true,
        reason: 'Chỉ Quản trị viên (Admin) mới có quyền xem số liệu chấm công toàn hệ thống.',
      };
    }
  }

  // 2. Xây dựng Query MongoDB
  const query = {};

  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } else if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  const dateFilter = buildAttendanceDateFilter(fromDate, toDate);
  Object.assign(query, dateFilter);

  // 3. Truy vấn tất cả bản ghi thỏa điều kiện
  const logs = await AttendanceLog.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime')
    .populate('scheduleId', 'roomId weekday subjectName')
    .sort({ checkInTime: -1, createdAt: -1 });

  // 4. Tính toán số liệu thống kê chính xác
  const total = logs.length;
  const onTime = logs.filter((l) => l.status === 'ON_TIME').length;
  const late = logs.filter((l) => l.status === 'LATE').length;
  const earlyLeave = logs.filter((l) => l.status === 'EARLY_LEAVE').length;
  const absent = logs.filter((l) => l.status === 'ABSENT').length;
  const excusedAbsent = logs.filter((l) => l.status === 'EXCUSED_ABSENCE').length;

  // Lọc danh sách người đi làm hôm nay (đúng giờ, trễ, về sớm)
  const presentLogs = logs.filter((l) => ['ON_TIME', 'LATE', 'EARLY_LEAVE'].includes(l.status));
  const distinctPresentUserIds = [...new Set(presentLogs.map((l) => l.userId?._id?.toString() || l.userId?.toString()))];

  return {
    total,
    onTime,
    late,
    earlyLeave,
    absent,
    excusedAbsent,
    presentUserCount: distinctPresentUserIds.length,
    logs,
  };
};


/**
 * Thống kê ai đi trễ nhiều nhất trong khoảng thời gian
 * @param {Object} params
 * @returns {Promise<Object>}
 */
const getTopLateUsers = async ({ departmentId, fromDate, toDate, limit = 5, currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!effectiveDeptId && currentUser?.role === 'truongkhoa' && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
  if (!perm.allowed) {
    return { unauthorized: true, reason: perm.reason };
  }

  let userFilter = {};
  if (perm.effectiveDeptIds && perm.effectiveDeptIds.length > 0) {
    userFilter = { departmentId: { $in: perm.effectiveDeptIds } };
  }

  const deptUserIds = await User.find(userFilter).distinct('_id');
  const dateFilter = buildAttendanceDateFilter(fromDate, toDate);

  const lateLogs = await AttendanceLog.find({
    userId: { $in: deptUserIds },
    status: 'LATE',
    ...dateFilter,
  }).populate('userId', 'fullName email role departmentId');

  // Nhóm theo người dùng
  const userLateMap = {};
  for (const log of lateLogs) {
    const uid = log.userId?._id?.toString();
    if (!uid) continue;
    if (!userLateMap[uid]) {
      userLateMap[uid] = {
        userId: uid,
        fullName: log.userId?.fullName || 'Không rõ',
        email: log.userId?.email || '',
        count: 0,
      };
    }
    userLateMap[uid].count += 1;
  }

  const sorted = Object.values(userLateMap).sort((a, b) => b.count - a.count);
  return {
    totalLateLogs: lateLogs.length,
    topUsers: sorted.slice(0, limit),
  };
};

/**
 * ============================================================================
 * 4. ANALYTICS ENGINE: LEAVE REQUEST (ĐƠN XIN NGHỈ / DẠY BÙ / ĐỔI CA)
 * ============================================================================
 */

/**
 * Lấy tổng hợp đơn xin nghỉ / dạy bù / đổi ca
 * @param {Object} params { status, type, userId, departmentId, fromDate, toDate, currentUser }
 * @returns {Promise<Object>}
 */
const getLeaveRequestSummary = async ({ status, type, userId, departmentId, fromDate, toDate, currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!userId && !effectiveDeptId && currentUser?.role === 'truongkhoa' && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  // 1. Kiểm tra phân quyền
  if (userId) {
    const perm = await checkUserPermission(currentUser, userId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else if (effectiveDeptId) {
    const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else {
    if (currentUser && currentUser.role !== 'admin') {
      return {
        unauthorized: true,
        reason: 'Chỉ Quản trị viên (Admin) mới có quyền xem toàn bộ đơn xin nghỉ trong toàn trường.',
      };
    }
  }

  const query = {};

  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } else if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (type) {
    query.type = type;
  }

  // Lọc theo ngày: Đơn có hiệu lực trong khoảng [fromDate, toDate]
  // Điều kiện giao thoa thời gian: startDate <= toDate && endDate >= fromDate
  if (fromDate && toDate) {
    query.startDate = { $lte: new Date(toDate) };
    query.endDate = { $gte: new Date(fromDate) };
  } else if (fromDate) {
    query.endDate = { $gte: new Date(fromDate) };
  } else if (toDate) {
    query.startDate = { $lte: new Date(toDate) };
  }

  const requests = await LeaveRequest.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('approvedBy', 'fullName email')
    .sort({ createdAt: -1 });

  const total = requests.length;
  const pending = requests.filter((r) => r.status === 'PENDING').length;
  const approved = requests.filter((r) => r.status === 'APPROVED').length;
  const rejected = requests.filter((r) => r.status === 'REJECTED').length;

  // Đếm theo loại
  const leaveNormal = requests.filter((r) => r.type === 'nghi_phep').length;
  const makeUpTeaching = requests.filter((r) => r.type === 'day_bu').length;
  const shiftChange = requests.filter((r) => r.type === 'doi_ca').length;

  // Tính tổng số ngày nghỉ đã được phê duyệt
  let totalApprovedDays = 0;
  requests
    .filter((r) => r.status === 'APPROVED' && r.type === 'nghi_phep')
    .forEach((r) => {
      const diffTime = Math.abs(new Date(r.endDate) - new Date(r.startDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      totalApprovedDays += diffDays;
    });

  return {
    total,
    pending,
    approved,
    rejected,
    byType: {
      nghi_phep: leaveNormal,
      day_bu: makeUpTeaching,
      doi_ca: shiftChange,
    },
    totalApprovedDays,
    requests,
  };
};

/**
 * ============================================================================
 * 5. ANALYTICS ENGINE: SCHEDULE (LỊCH GIẢNG DẠY & LỊCH LẶP RECURRING)
 * ============================================================================
 */

/**
 * Đếm chính xác số buổi dạy thực tế trong khoảng thời gian
 * Xử lý lịch lặp tuần (isRecurring: true + weekday)
 * @param {Object} params { userId, departmentId, fromDate, toDate, currentUser }
 * @returns {Promise<Object>}
 */
const countTeachingSessions = async ({ userId, departmentId, fromDate, toDate, currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!userId && !effectiveDeptId && currentUser?.role === 'truongkhoa' && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  // 1. Kiểm tra phân quyền
  if (userId) {
    const perm = await checkUserPermission(currentUser, userId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else if (effectiveDeptId) {
    const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
    if (!perm.allowed) {
      return { unauthorized: true, reason: perm.reason };
    }
  } else {
    if (currentUser && currentUser.role !== 'admin') {
      return {
        unauthorized: true,
        reason: 'Chỉ Quản trị viên (Admin) mới có quyền xem toàn bộ lịch giảng dạy trong toàn trường.',
      };
    }
  }

  const query = {};

  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } else if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  // Khoảng hiệu lực của schedule phải giao thoa với [fromDate, toDate]
  if (fromDate && toDate) {
    query.startDate = { $lte: new Date(toDate) };
    query.endDate = { $gte: new Date(fromDate) };
  }

  const schedules = await Schedule.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime lateThresholdMinutes')
    .sort({ weekday: 1, startTime: 1 });

  // 2. Tính toán chính xác từng ngày dạy thực tế
  // Duyệt từ fromDate đến toDate từng ngày một theo múi giờ Việt Nam
  const startDayTime = fromDate ? new Date(fromDate).getTime() : Date.now();
  const endDayTime = toDate ? new Date(toDate).getTime() : Date.now();

  const sessions = [];

  // Duyệt từng lịch dạy
  for (const sch of schedules) {
    const schStart = new Date(sch.startDate).getTime();
    const schEnd = new Date(sch.endDate).getTime();

    // Khoảng giao thoa giữa thời gian tìm kiếm và thời gian của lịch
    const effectiveStart = Math.max(startDayTime, schStart);
    const effectiveEnd = Math.min(endDayTime, schEnd);

    if (effectiveStart > effectiveEnd) continue;

    // Duyệt từng ngày trong khoảng giao thoa
    let cursor = new Date(effectiveStart);
    // Chuẩn hóa cursor về 12:00 UTC để tránh lệch ngày
    while (cursor.getTime() <= effectiveEnd) {
      const parts = getVietnamParts(cursor);
      // Kiểm tra xem thứ của ngày hiện tại có trùng với weekday của schedule không
      if (parts.weekday === sch.weekday) {
        sessions.push({
          dateStr: parts.dateStr,
          dateDisplay: `${parts.day}/${parts.month}/${parts.year}`,
          weekday: sch.weekday,
          subjectName: sch.subjectName || 'Không có tên môn',
          subjectCode: sch.subjectCode || '',
          roomId: sch.roomId || '',
          shiftName: sch.shiftId?.name || '',
          startTime: sch.startTime || sch.shiftId?.startTime || '',
          endTime: sch.endTime || sch.shiftId?.endTime || '',
          teacherName: sch.userId?.fullName || 'N/A',
          teacherId: sch.userId?._id?.toString(),
        });
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return {
    totalSchedulesConfigured: schedules.length,
    totalActualSessions: sessions.length,
    sessions,
  };
};

/**
 * Đếm số giảng viên có lịch dạy trong ngày cụ thể (ví dụ hôm nay) theo Khoa
 * @param {Object} params { departmentId, date, currentUser }
 * @returns {Promise<Object>}
 */
const countTeachersWithScheduleOnDate = async ({ departmentId, date = new Date(), currentUser }) => {
  let effectiveDeptId = departmentId;
  if (!effectiveDeptId && currentUser?.role === 'truongkhoa' && currentUser?.departmentId) {
    effectiveDeptId = currentUser.departmentId;
  }

  const perm = await checkDepartmentPermission(currentUser, effectiveDeptId);
  if (!perm.allowed) {
    return { unauthorized: true, reason: perm.reason };
  }

  const { dateStr, weekday } = getVietnamParts(date);
  const startOfDay = createVietnamDate(dateStr, '00:00:00.000');
  const endOfDay = createVietnamDate(dateStr, '23:59:59.999');

  const query = {
    weekday,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  };

  if (effectiveDeptId) {
    const scopedDepts = await getDepartmentScopeIds(effectiveDeptId);
    const usersInDept = await User.find({ departmentId: { $in: scopedDepts } }).distinct('_id');
    query.userId = { $in: usersInDept };
  }

  const schedules = await Schedule.find(query)
    .populate('userId', 'fullName email role departmentId')
    .populate('shiftId', 'name startTime endTime');

  const distinctTeachers = {};
  for (const s of schedules) {
    const uid = s.userId?._id?.toString();
    if (uid && !distinctTeachers[uid]) {
      distinctTeachers[uid] = {
        id: uid,
        fullName: s.userId?.fullName || 'N/A',
        email: s.userId?.email || '',
        sessionsCount: 0,
      };
    }
    if (uid) {
      distinctTeachers[uid].sessionsCount += 1;
    }
  }

  const teachersList = Object.values(distinctTeachers);

  return {
    date: dateStr,
    totalTeachers: teachersList.length,
    totalSessions: schedules.length,
    teachers: teachersList,
    schedules,
  };
};

module.exports = {
  // Authorization
  checkUserPermission,
  checkDepartmentPermission,
  // Entity Resolution
  resolveUser,
  resolveDepartment,
  // Attendance
  getAttendanceSummary,
  getTopLateUsers,
  // Leave Request
  getLeaveRequestSummary,
  // Schedule
  countTeachingSessions,
  countTeachersWithScheduleOnDate,
};
