const AuditLog = require('../models/auditLog.model');
const { sendSuccess } = require('../utils/responseHandler');

const getAuditLogs = async (req, res, next) => {
  try {
    const { actor, action, targetType, startDate, endDate } = req.query;
    const query = {};

    if (actor) query.actor = actor;
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (startDate && endDate) {
      query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const logs = await AuditLog.find(query)
      .populate('actor', 'fullName email role')
      .sort({ timestamp: -1 });

    return sendSuccess(res, 'Lấy danh sách nhật ký kiểm toán (Audit Logs) thành công.', {
      totalRecords: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
};
