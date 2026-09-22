const mongoose = require('mongoose');
const LeaveRequest = require('../models/leaveRequest.model');
const AttendanceLog = require('../models/attendanceLog.model');
const Schedule = require('../models/schedule.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { sendLeaveApprovedEmail, sendLeaveRejectedEmail } = require('../services/email.service');
const { getDeanScopedUserIds, isUserInDeanScope } = require('../utils/deanScope');

const getVietnamDateKey = (date) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const getLeaveOccurrenceDates = (startDate, endDate, weekday) => {
  const startKey = getVietnamDateKey(startDate);
  const endKey = getVietnamDateKey(endDate);
  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const occurrences = [];

  while (cursor <= end) {
    if (cursor.getUTCDay() === Number(weekday)) {
      const dateKey = cursor.toISOString().slice(0, 10);
      occurrences.push(new Date(`${dateKey}T00:00:00.000+07:00`));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
};

/**
 * Tính chính xác số ngày nghỉ theo ngày lịch (Calendar Days),
 * chuẩn hóa về UTC 00:00:00 để tránh sai số do giờ làm việc (08:00 - 17:00).
 */
const calculateLeaveDays = (startDate, endDate) => {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return 0;
  }
  const sUtc = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const eUtc = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
  const diffDays = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

/**
 * Tối ưu hóa Database: Tính số ngày phép đã sử dụng (APPROVED) và đang chờ duyệt (PENDING)
 * trong năm bằng MongoDB Aggregation Pipeline thay vì tải dữ liệu về RAM để lặp qua JS.
 */
const getLeaveStatsByYear = async (userId, year) => {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [stats] = await LeaveRequest.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ['APPROVED', 'PENDING'] },
        startDate: { $lte: yearEnd },
        endDate: { $gte: yearStart },
      },
    },
    {
      $project: {
        type: 1,
        status: 1,
        effectiveStart: { $max: ['$startDate', yearStart] },
        effectiveEnd: { $min: ['$endDate', yearEnd] },
      },
    },
    {
      $project: {
        type: 1,
        status: 1,
        leaveDays: {
          $add: [
            {
              $round: [
                {
                  $divide: [
                    { $subtract: ['$effectiveEnd', '$effectiveStart'] },
                    86400000, // 1000 * 60 * 60 * 24
                  ],
                },
                0,
              ],
            },
            1,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        // Chỉ tính nghỉ phép thường đã duyệt vào ngày phép năm đã sử dụng
        daysUsed: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'APPROVED'] }, { $eq: ['$type', 'nghi_phep'] }] },
              '$leaveDays',
              0,
            ],
          },
        },
        // Tổng số ngày của tất cả các đơn đang chờ duyệt (nghi_phep, day_bu, doi_ca)
        pendingDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PENDING'] }, '$leaveDays', 0],
          },
        },
        // Số ngày nghỉ phép thường đang chờ duyệt (để tính hạn mức trừ vào 12 ngày phép năm)
        pendingAnnualLeaveDays: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'PENDING'] }, { $eq: ['$type', 'nghi_phep'] }] },
              '$leaveDays',
              0,
            ],
          },
        },
        // Tổng số lượng đơn đang chờ duyệt
        pendingRequestsCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0],
          },
        },
      },
    },
  ]);

  return {
    daysUsed: stats?.daysUsed || 0,
    pendingDays: stats?.pendingDays || 0,
    pendingAnnualLeaveDays: stats?.pendingAnnualLeaveDays || 0,
    pendingRequestsCount: stats?.pendingRequestsCount || 0,
  };
};

// Khóa chống Race Condition: Ngăn chặn gửi 2 đơn đồng thời (Double-Click / Spam) từ cùng một user
const activeLeaveSubmissions = new Set();

/**
 * @desc Tạo đơn xin nghỉ phép / dạy bù / đổi ca
 * @route POST /api/leave-requests
 */
const createLeaveRequest = async (req, res, next) => {
  const userId = req.user?.id;
  const lockKey = `leave_lock:${userId}`;

  if (activeLeaveSubmissions.has(lockKey)) {
    return sendError(
      res,
      'Yêu cầu nộp đơn xin nghỉ của bạn đang được xử lý. Vui lòng không nhấn nút gửi liên tục.',
      null,
      429,
      'CONCURRENT_SUBMISSION_BLOCKED'
    );
  }

  activeLeaveSubmissions.add(lockKey);

  try {
    // Quản trị viên (Admin) giữ quyền cao nhất hệ thống, không áp dụng tạo đơn xin nghỉ
    if (req.user.role === 'admin') {
      return sendError(
        res,
        'Quản trị viên (Admin) giữ quyền phê duyệt cao nhất hệ thống, không áp dụng tạo đơn xin nghỉ cá nhân; chỉ có thẩm quyền phê duyệt hoặc từ chối đơn của cán bộ, giảng viên.',
        null,
        403
      );
    }

    const { type, reason, startDate, endDate, attachmentUrl } = req.body;

    // VULN-01: Kiểm tra kiểu dữ liệu nghiêm ngặt trước khi gọi hàm chuỗi
    if (!type || typeof type !== 'string' || !reason || typeof reason !== 'string' || !startDate || !endDate) {
      return sendError(res, 'Vui lòng cung cấp loại đơn (type), lý do (reason), ngày bắt đầu và kết thúc dạng hợp lệ.', null, 400);
    }

    const validTypes = ['nghi_phep', 'day_bu', 'doi_ca'];
    if (!validTypes.includes(type)) {
      return sendError(res, 'Loại đơn không hợp lệ. Chỉ chấp nhận: nghi_phep, day_bu, doi_ca.', null, 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return sendError(res, 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.', null, 400);
    }

    if (end < start) {
      return sendError(res, 'Ngày kết thúc không thể trước ngày bắt đầu.', null, 400);
    }

    // FLAW-01: Chặn nộp đơn lùi về các ngày trong quá khứ
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (start < todayStart) {
      return sendError(res, 'Không thể nộp đơn xin nghỉ lùi về các ngày trong quá khứ.', null, 400);
    }

    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      return sendError(res, 'Lý do phải có từ 5 đến 500 ký tự.', null, 400);
    }

    // Kiểm tra chống trùng lặp khoảng thời gian đơn nghỉ đã nộp (PENDING hoặc APPROVED)
    const overlappingLeave = await LeaveRequest.findOne({
      userId: req.user.id,
      status: { $in: ['PENDING', 'APPROVED'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlappingLeave) {
      const statusDesc = overlappingLeave.status === 'APPROVED' ? 'đã được phê duyệt' : 'đang chờ xét duyệt';
      const startFormatted = new Date(overlappingLeave.startDate).toLocaleDateString('vi-VN');
      const endFormatted = new Date(overlappingLeave.endDate).toLocaleDateString('vi-VN');
      return sendError(
        res,
        `Bạn đã có một đơn nghỉ (${statusDesc}) từ ngày ${startFormatted} đến ${endFormatted} trùng với thời gian này.`,
        null,
        400
      );
    }

    // Kiểm tra hạn mức ngày phép năm nếu nộp đơn nghỉ phép thường
    if (type === 'nghi_phep') {
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      // FLAW-03: Chỉ tính số ngày nghỉ rơi đúng vào năm đang xét
      const currentYearLeavesStart = new Date(Math.max(start.getTime(), yearStart.getTime()));
      const currentYearLeavesEnd = new Date(Math.min(end.getTime(), yearEnd.getTime()));
      const requestedDaysInYear = calculateLeaveDays(currentYearLeavesStart, currentYearLeavesEnd);

      const user = await User.findById(req.user.id);
      const quota = user?.annualLeaveQuota !== undefined ? user.annualLeaveQuota : 12;

      // FLAW-02: Tối ưu Aggregation Pipeline - tính tổng ngày phép chiếm dụng (APPROVED + PENDING của loại nghi_phep)
      const { daysUsed, pendingAnnualLeaveDays } = await getLeaveStatsByYear(req.user.id, currentYear);
      const daysOccupied = daysUsed + pendingAnnualLeaveDays;

      const availableDays = Math.max(0, quota - daysOccupied);
      if (availableDays <= 0) {
        return sendError(
          res,
          `Bạn đã sử dụng hoặc đang có đơn chờ duyệt hết ${quota} ngày phép năm. Vui lòng chọn loại đơn "Đăng ký dạy bù" hoặc "Xin đổi ca dạy".`,
          null,
          400
        );
      }

      if (requestedDaysInYear > availableDays) {
        return sendError(
          res,
          `Số ngày xin nghỉ thuộc năm ${currentYear} (${requestedDaysInYear} ngày) vượt quá số ngày phép khả dụng (${availableDays} ngày, đã bao gồm các đơn đang chờ duyệt).`,
          null,
          400
        );
      }
    }

    // Nếu người dùng tải file trực tiếp qua multipart/form-data thì lấy req.file, ngược lại dùng attachmentUrl
    let finalAttachmentUrl = typeof attachmentUrl === 'string' ? attachmentUrl.trim() : null;
    if (req.file) {
      finalAttachmentUrl = `/uploads/${req.file.filename}`;
    }

    const leaveRequest = await LeaveRequest.create({
      userId: req.user.id,
      type,
      reason: normalizedReason,
      startDate: start,
      endDate: end,
      attachmentUrl: finalAttachmentUrl,
      status: 'PENDING',
    });

    return sendSuccess(res, 'Gửi đơn thành công.', leaveRequest, 201);
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        'Bạn đã có một đơn nghỉ trùng lặp thời gian đang chờ duyệt hoặc đã duyệt trong hệ thống.',
        null,
        409,
        'DUPLICATE_LEAVE_REQUEST'
      );
    }
    next(error);
  } finally {
    if (lockKey) {
      activeLeaveSubmissions.delete(lockKey);
    }
  }
};

/**
 * @desc Danh sách đơn xin nghỉ phép/dạy bù
 * @route GET /api/leave-requests
 */
const getLeaveRequests = async (req, res, next) => {
  try {
    const { status, type, userId } = req.query;
    const query = {};

    if (status && typeof status === 'string') query.status = status;
    if (type && typeof type === 'string') query.type = type;

    // VULN-02: Sanitize userId query để chống NoSQL Injection
    if (userId) {
      if (typeof userId !== 'string' || !mongoose.Types.ObjectId.isValid(userId)) {
        return sendError(res, 'Mã người dùng (userId) không hợp lệ.', null, 400);
      }
    }

    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      // Giảng viên / nhân viên mặc định chỉ xem đơn của mình
      query.userId = req.user.id;
    } else if (req.user.role === 'truongkhoa') {
      const facultyUserIds = await getDeanScopedUserIds(req.user);

      if (userId) {
        if (!facultyUserIds.includes(userId.toString())) {
          return sendError(res, 'Bạn không có quyền xem đơn của nhân sự ngoài khoa.', null, 403);
        }
        query.userId = userId;
      } else {
        query.userId = { $in: facultyUserIds };
      }
    } else if (req.user.role === 'admin') {
      if (userId) query.userId = userId;
    }

    const requests = await LeaveRequest.find(query)
      .populate('userId', 'fullName email role departmentId avatar')
      .populate('approvedBy', 'fullName email role avatar')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Lấy danh sách đơn thành công.', requests);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Chi tiết một đơn
 * @route GET /api/leave-requests/:id
 */
const getLeaveRequestById = async (req, res, next) => {
  try {
    // VULN-03: Validate id param
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 'Mã đơn (id) không hợp lệ.', null, 400);
    }

    const request = await LeaveRequest.findById(req.params.id)
      .populate('userId', 'fullName email role departmentId avatar')
      .populate('approvedBy', 'fullName email role avatar');

    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    // Phân quyền xem đơn
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      if (request.userId._id.toString() !== req.user.id) {
        return sendError(res, 'Bạn không có quyền xem đơn này.', null, 403);
      }
    } else if (req.user.role === 'truongkhoa') {
      const inScope = await isUserInDeanScope(req.user, request.userId._id || request.userId);
      if (!inScope) {
        return sendError(res, 'Bạn không có quyền xem đơn của nhân sự ngoài khoa.', null, 403);
      }
    }

    return sendSuccess(res, 'Lấy chi tiết đơn thành công.', request);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Xem số ngày phép còn lại (Leave Balance) của người dùng
 * Dùng pipeline aggregate ($match theo userId, status, type rồi cộng dồn số ngày nghỉ thực tế)
 * @route GET /api/leave-requests/balance
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    let targetUserId = req.user.id;

    // Kiểm tra phân quyền: Giảng viên / Nhân viên chỉ xem của chính mình
    if (req.query.userId && req.query.userId !== req.user.id) {
      // VULN-02: Sanitize userId query
      if (typeof req.query.userId !== 'string' || !mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return sendError(res, 'Mã người dùng (userId) không hợp lệ.', null, 400);
      }

      if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
        return sendError(res, 'Bạn chỉ có quyền tra cứu số dư ngày phép của chính mình.', null, 403);
      }
      if (req.user.role === 'truongkhoa') {
        const inScope = await isUserInDeanScope(req.user, req.query.userId);
        if (!inScope) {
          return sendError(res, 'Bạn không có quyền xem số dư ngày phép của nhân sự ngoài khoa.', null, 403);
        }
        targetUserId = req.query.userId;
      } else if (req.user.role === 'admin') {
        targetUserId = req.query.userId;
      }
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404);
    }

    const currentYear = new Date().getFullYear();

    // Tài khoản Quản trị viên (Admin) không áp dụng quản lý hạn mức ngày phép cá nhân
    if (user.role === 'admin') {
      return sendSuccess(res, 'Tài khoản Quản trị viên (Admin) không áp dụng quản lý hạn mức ngày phép.', {
        userId: targetUserId,
        year: currentYear,
        annualLeaveQuota: 0,
        daysUsed: 0,
        pendingDays: 0,
        pendingAnnualLeaveDays: 0,
        pendingRequestsCount: 0,
        remainingDays: 0,
        availableDays: 0,
        isAdmin: true,
      });
    }

    const quota = user.annualLeaveQuota !== undefined ? user.annualLeaveQuota : 12;

    // Tối ưu hóa Database: Sử dụng Aggregation Pipeline duy nhất để tính song song daysUsed, pendingDays, pendingRequestsCount
    const { daysUsed, pendingDays, pendingAnnualLeaveDays, pendingRequestsCount } =
      await getLeaveStatsByYear(targetUserId, currentYear);
    const remainingDays = Math.max(0, quota - daysUsed);
    const availableDays = Math.max(0, quota - daysUsed - pendingAnnualLeaveDays);

    return sendSuccess(res, 'Tính số dư ngày phép thành công.', {
      userId: targetUserId,
      year: currentYear,
      annualLeaveQuota: quota,
      daysUsed,
      pendingDays,
      pendingAnnualLeaveDays,
      pendingRequestsCount,
      remainingDays,
      availableDays,
      isAdmin: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Kiểm tra phân cấp quyền duyệt/từ chối đơn theo cấp bậc:
 * - Không được tự duyệt đơn của chính mình
 * - Admin có toàn quyền duyệt mọi đơn
 * - Trưởng khoa chỉ duyệt nhân sự thuộc khoa mình (hoặc bộ môn con trực thuộc)
 * - Đơn của Trưởng khoa bắt buộc phải do Admin duyệt
 */
const validateLeaveApprovalPermission = async (currentUser, leaveRequest) => {
  const applicantId = (leaveRequest.userId?._id || leaveRequest.userId).toString();

  // 1. Chặn người dùng tự duyệt/từ chối đơn của chính mình
  if (applicantId === currentUser.id.toString()) {
    return {
      allowed: false,
      message: 'Bạn không thể tự xử lý đơn xin nghỉ của chính mình. Đơn của bạn phải do cấp trên phê duyệt.',
      status: 403,
    };
  }

  // 2. Admin có toàn quyền xử lý tất cả các đơn
  if (currentUser.role === 'admin') {
    return { allowed: true };
  }

  // 3. Nếu là Trưởng khoa
  if (currentUser.role === 'truongkhoa') {
    const applicant = await User.findById(applicantId).select('role departmentId');
    if (!applicant) {
      return { allowed: false, message: 'Người nộp đơn không tồn tại trên hệ thống.', status: 404 };
    }

    // Đơn của Trưởng khoa hoặc Admin bắt buộc phải do Admin duyệt
    if (applicant.role === 'truongkhoa' || applicant.role === 'admin') {
      return {
        allowed: false,
        message: 'Chỉ Quản trị viên (Admin) mới có quyền phê duyệt/từ chối đơn của Trưởng khoa.',
        status: 403,
      };
    }

    // Kiểm tra nhân sự có thuộc khoa của Trưởng khoa (hoặc bộ môn trực thuộc khoa) hay không
    const inScope = await isUserInDeanScope(currentUser, applicant._id);
    if (!inScope) {
      return {
        allowed: false,
        message: 'Bạn chỉ có quyền phê duyệt/từ chối đơn của nhân sự thuộc khoa của mình.',
        status: 403,
      };
    }

    return { allowed: true };
  }

  return { allowed: false, message: 'Bạn không có quyền thực hiện hành động này.', status: 403 };
};

/**
 * @desc Phê duyệt đơn
 * @route PUT /api/leave-requests/:id/approve
 */
const approveLeaveRequest = async (req, res, next) => {
  try {
    // VULN-03: Validate id param
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 'Mã đơn (id) không hợp lệ.', null, 400);
    }

    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    if (request.status !== 'PENDING') {
      return sendError(res, `Đơn đã được xử lý với trạng thái ${request.status}.`, null, 400);
    }

    // Kiểm tra phân cấp quyền duyệt đơn: Trưởng khoa duyệt nhân sự trong khoa, Admin duyệt Trưởng khoa
    const permCheck = await validateLeaveApprovalPermission(req.user, request);
    if (!permCheck.allowed) {
      return sendError(res, permCheck.message, null, permCheck.status || 403);
    }

    // Nếu là đơn nghỉ phép thường, kiểm tra xem người nộp đơn còn đủ số dư phép hay không
    if (request.type === 'nghi_phep') {
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      // FLAW-03: Chỉ tính số ngày xin nghỉ thuộc năm đang xét
      const currentYearLeavesStart = new Date(Math.max(request.startDate.getTime(), yearStart.getTime()));
      const currentYearLeavesEnd = new Date(Math.min(request.endDate.getTime(), yearEnd.getTime()));
      const requestedDays = calculateLeaveDays(currentYearLeavesStart, currentYearLeavesEnd);

      const applicantUser = await User.findById(request.userId);
      const quota = applicantUser?.annualLeaveQuota !== undefined ? applicantUser.annualLeaveQuota : 12;

      // Tối ưu Aggregation Pipeline: Tính số ngày đã sử dụng trực tiếp trên Database
      const { daysUsed } = await getLeaveStatsByYear(request.userId, currentYear);

      const remainingDays = Math.max(0, quota - daysUsed);
      if (requestedDays > remainingDays) {
        return sendError(
          res,
          `Không thể phê duyệt đơn: Cán bộ/giảng viên chỉ còn ${remainingDays} ngày phép khả dụng, đơn này xin nghỉ ${requestedDays} ngày trong năm ${currentYear}.`,
          null,
          400
        );
      }
    }

    // VULN-04: Atomic State Transition chống Race Condition / TOCTOU
    const approvalNote = typeof req.body.approvalNote === 'string' ? req.body.approvalNote.trim() : '';
    const updatedRequest = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'PENDING' },
      {
        $set: {
          status: 'APPROVED',
          approvedBy: req.user.id,
          approvalNote,
          rejectionReason: null,
        },
      },
      { new: true }
    );

    if (!updatedRequest) {
      return sendError(res, 'Đơn không còn ở trạng thái chờ duyệt hoặc đã được xử lý bởi người khác.', null, 409);
    }

    // Tích hợp chéo với Module Attendance (TV B):
    // Khi đơn được duyệt (APPROVED), tự động tạo/cập nhật bản ghi attendance_logs với status = 'EXCUSED_ABSENCE' và gán leaveRequestId
    if (request.type === 'nghi_phep') {
      const schedules = await Schedule.find({
        userId: request.userId,
        startDate: { $lte: request.endDate },
        endDate: { $gte: request.startDate },
      });

      const bulkOps = [];
      for (const sch of schedules) {
        const occurrenceStart = new Date(Math.max(request.startDate.getTime(), sch.startDate.getTime()));
        const occurrenceEnd = new Date(Math.min(request.endDate.getTime(), sch.endDate.getTime()));
        const occurrenceDates = getLeaveOccurrenceDates(occurrenceStart, occurrenceEnd, sch.weekday);

        for (const occurrenceDate of occurrenceDates) {
          const workDateStr = getVietnamDateKey(occurrenceDate);
          bulkOps.push({
            updateOne: {
              filter: {
                userId: request.userId,
                scheduleId: sch._id,
                workDate: workDateStr,
              },
              update: {
                $set: {
                  status: 'EXCUSED_ABSENCE',
                  leaveRequestId: request._id,
                  checkInTime: null,
                  checkOutTime: null,
                },
                $setOnInsert: {
                  shiftId: sch.shiftId,
                  method: 'system',
                  deviceId: 'SYSTEM_LEAVE',
                  isManualOverride: false,
                },
              },
              upsert: true,
            },
          });
        }
      }

      // Tối ưu N+1 Query: Sử dụng bulkWrite để thực thi tất cả các bản ghi điểm danh trong 1 network round-trip
      if (bulkOps.length > 0) {
        await AttendanceLog.bulkWrite(bulkOps, { ordered: false });
      }
    }

    // Ghi audit log
    await AuditLog.create({
      actor: req.user.id,
      action: 'APPROVE_LEAVE',
      targetId: request._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      timestamp: new Date(),
    });

    // Thông báo email là tác vụ nền (non-blocking): không dùng await để tránh làm chậm phản hồi HTTP
    const applicant = await User.findById(request.userId).select('email fullName');
    const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
    const mailPass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
    if (applicant?.email && mailUser && mailPass) {
      sendLeaveApprovedEmail({
        to: applicant.email,
        fullName: applicant.fullName,
        fromDate: request.startDate,
        toDate: request.endDate,
        approvalNote: request.approvalNote,
      }).catch((mailError) => {
        console.error('Gửi email duyệt đơn thất bại:', mailError.message);
      });
    }

    return sendSuccess(res, 'Đã phê duyệt đơn thành công và đồng bộ chấm công có phép (EXCUSED_ABSENCE).', updatedRequest);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Từ chối đơn kèm rejectionReason
 * @route PUT /api/leave-requests/:id/reject
 */
const rejectLeaveRequest = async (req, res, next) => {
  try {
    // VULN-03: Validate id param
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 'Mã đơn (id) không hợp lệ.', null, 400);
    }

    const { rejectionReason } = req.body;

    // VULN-01: Kiểm tra kiểu dữ liệu nghiêm ngặt
    if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      return sendError(res, 'Lý do từ chối (rejectionReason) là chuỗi bắt buộc khi từ chối đơn.', null, 400);
    }

    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    if (request.status !== 'PENDING') {
      return sendError(res, `Đơn đã được xử lý với trạng thái ${request.status}.`, null, 400);
    }

    // Kiểm tra phân cấp quyền từ chối đơn: Trưởng khoa chỉ xử lý nhân sự trong khoa, Admin duyệt Trưởng khoa
    const permCheck = await validateLeaveApprovalPermission(req.user, request);
    if (!permCheck.allowed) {
      return sendError(res, permCheck.message, null, permCheck.status || 403);
    }

    // VULN-04: Atomic State Transition chống Race Condition / TOCTOU
    const updatedRequest = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'PENDING' },
      {
        $set: {
          status: 'REJECTED',
          approvedBy: req.user.id,
          rejectionReason: rejectionReason.trim(),
        },
      },
      { new: true }
    );

    if (!updatedRequest) {
      return sendError(res, 'Đơn không còn ở trạng thái chờ duyệt hoặc đã được xử lý bởi người khác.', null, 409);
    }

    // Ghi audit log
    await AuditLog.create({
      actor: req.user.id,
      action: 'REJECT_LEAVE',
      targetId: request._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: req.ip || req.connection.remoteAddress,
      timestamp: new Date(),
    });

    // Thông báo email là tác vụ nền (non-blocking): không dùng await để tránh làm chậm phản hồi HTTP
    const applicant = await User.findById(request.userId).select('email fullName');
    const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
    const mailPass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
    if (applicant?.email && mailUser && mailPass) {
      sendLeaveRejectedEmail({
        to: applicant.email,
        fullName: applicant.fullName,
        fromDate: request.startDate,
        toDate: request.endDate,
        rejectionReason: request.rejectionReason,
      }).catch((mailError) => {
        console.error('Gửi email từ chối đơn thất bại:', mailError.message);
      });
    }

    return sendSuccess(res, 'Đã từ chối đơn thành công.', updatedRequest);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  getLeaveBalance,
  approveLeaveRequest,
  rejectLeaveRequest,
  calculateLeaveDays,
  getLeaveStatsByYear,
};
