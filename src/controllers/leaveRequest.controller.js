const LeaveRequest = require('../models/leaveRequest.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const createLeaveRequest = async (req, res, next) => {
  try {
    const { scheduleId, requestType, reason, fromDate, toDate } = req.body;
    const leaveRequest = await LeaveRequest.create({
      user: req.user.id,
      schedule: scheduleId || null,
      requestType,
      reason,
      fromDate,
      toDate,
    });
    return sendSuccess(res, 'Gửi đơn xin nghỉ phép/dạy bù thành công.', leaveRequest, 201);
  } catch (error) {
    next(error);
  }
};

const getLeaveRequests = async (req, res, next) => {
  try {
    const { status, userId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (userId) query.user = userId;
    else if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      query.user = req.user.id;
    }

    const requests = await LeaveRequest.find(query)
      .populate('user', 'fullName userCode title')
      .populate('schedule')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Lấy danh sách đơn xin thành công.', requests);
  } catch (error) {
    next(error);
  }
};

const approveLeaveRequest = async (req, res, next) => {
  try {
    const { status, approvalNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return sendError(res, 'Trạng thái phê duyệt không hợp lệ.', null, 400);
    }

    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return sendError(res, 'Không tìm thấy đơn xin.', null, 404);
    }

    request.status = status;
    request.approvedBy = req.user.id;
    request.approvalNote = approvalNote || '';
    await request.save();

    return sendSuccess(res, 'Xử lý duyệt đơn thành công.', request);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  approveLeaveRequest,
};
