const mongoose = require('mongoose');
const LeaveRequest = require('../models/leaveRequest.model');
const User = require('../models/user.model');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * @desc Tạo đơn xin nghỉ phép / dạy bù / đổi ca
 * @route POST /api/leave-requests
 */
const createLeaveRequest = async (req, res, next) => {
  try {
    const { type, reason, startDate, endDate, attachmentUrl } = req.body;

    if (!type || !reason || !startDate || !endDate) {
      return sendError(res, 'Vui lòng cung cấp loại đơn (type), lý do (reason), ngày bắt đầu và kết thúc.', null, 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return sendError(res, 'Ngày kết thúc không thể trước ngày bắt đầu.', null, 400);
    }

    const leaveRequest = await LeaveRequest.create({
      userId: req.user.id,
      type,
      reason,
      startDate: start,
      endDate: end,
      attachmentUrl: attachmentUrl || null,
      status: 'PENDING',
    });

    return sendSuccess(res, 'Gửi đơn thành công.', leaveRequest, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Lấy danh sách đơn xin nghỉ phép / công tác
 * @route GET /api/leave-requests
 */
const getLeaveRequests = async (req, res, next) => {
  try {
    const { status, type, userId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;

    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      // Giảng viên / nhân viên mặc định chỉ xem đơn của mình
      query.userId = req.user.id;
    } else if (req.user.role === 'truongkhoa') {
      const myInfo = await User.findById(req.user.id);
      const facultyUsers = await User.find({ departmentId: myInfo.departmentId }).select('_id');
      const facultyUserIds = facultyUsers.map((u) => u._id);

      if (userId) {
        if (!facultyUserIds.some((id) => id.toString() === userId)) {
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
      .populate('userId', 'fullName email role departmentId')
      .populate('approvedBy', 'fullName email role')
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
    const request = await LeaveRequest.findById(req.params.id)
      .populate('userId', 'fullName email role departmentId')
      .populate('approvedBy', 'fullName email role');

    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    // Phân quyền xem đơn
    if (req.user.role === 'giangvien' || req.user.role === 'nhanvien') {
      if (request.userId._id.toString() !== req.user.id) {
        return sendError(res, 'Bạn không có quyền xem đơn này.', null, 403);
      }
    } else if (req.user.role === 'truongkhoa') {
      const myInfo = await User.findById(req.user.id);
      if (request.userId.departmentId && request.userId.departmentId.toString() !== myInfo.departmentId.toString()) {
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
    const targetUserId = req.query.userId || req.user.id;

    const user = await User.findById(targetUserId);
    if (!user) {
      return sendError(res, 'Không tìm thấy người dùng.', null, 404);
    }

    const quota = user.annualLeaveQuota !== undefined ? user.annualLeaveQuota : 12;

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const matchStage = {
      userId: new mongoose.Types.ObjectId(targetUserId),
      status: 'APPROVED',
      type: 'nghi_phep',
      startDate: { $gte: yearStart, $lte: yearEnd },
    };

    const aggregateResult = await LeaveRequest.aggregate([
      { $match: matchStage },
      {
        $project: {
          daysUsed: {
            $add: [
              {
                $divide: [
                  { $subtract: ['$endDate', '$startDate'] },
                  1000 * 60 * 60 * 24,
                ],
              },
              1, // Cộng thêm 1 ngày vì tính cả ngày bắt đầu
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalDaysUsed: { $sum: '$daysUsed' },
        },
      },
    ]);

    const daysUsed = aggregateResult.length > 0 ? Math.ceil(aggregateResult[0].totalDaysUsed) : 0;
    const remainingDays = Math.max(0, quota - daysUsed);

    return sendSuccess(res, 'Tính số dư ngày phép thành công.', {
      userId: targetUserId,
      year: currentYear,
      annualLeaveQuota: quota,
      daysUsed,
      remainingDays,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Phê duyệt đơn
 * @route PUT /api/leave-requests/:id/approve
 */
const approveLeaveRequest = async (req, res, next) => {
  try {
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    request.status = 'APPROVED';
    request.approvedBy = req.user.id;
    request.rejectionReason = null;
    await request.save();

    // Ghi audit log
    await AuditLog.create({
      actor: req.user.id,
      action: 'APPROVE_LEAVE',
      targetId: request._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: req.ip || req.connection.remoteAddress,
      timestamp: new Date(),
    });

    return sendSuccess(res, 'Đã phê duyệt đơn thành công.', request);
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
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return sendError(res, 'Lý do từ chối (rejectionReason) là bắt buộc khi từ chối đơn.', null, 400);
    }

    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    request.status = 'REJECTED';
    request.approvedBy = req.user.id;
    request.rejectionReason = rejectionReason;
    await request.save();

    // Ghi audit log
    await AuditLog.create({
      actor: req.user.id,
      action: 'REJECT_LEAVE',
      targetId: request._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: req.ip || req.connection.remoteAddress,
      timestamp: new Date(),
    });

    return sendSuccess(res, 'Đã từ chối đơn thành công.', request);
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
};
