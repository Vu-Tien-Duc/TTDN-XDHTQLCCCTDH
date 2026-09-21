const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Lấy danh sách nhật ký kiểm toán (Audit Logs)
 * Hỗ trợ phân trang, lọc theo actor, action, targetType và khoảng thời gian độc lập
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { actor, action, targetType, startDate, endDate, page, limit } = req.query;
    const query = {};

    if (actor) {
      if (actor === 'null' || actor === 'SYSTEM') {
        query.actor = null;
      } else if (!mongoose.Types.ObjectId.isValid(actor)) {
        return sendError(res, 'ID người thực hiện (actor) không đúng định dạng ObjectId hợp lệ.', null, 400);
      } else {
        query.actor = actor;
      }
    }
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    // Xử lý bộ lọc thời gian & validate
    let parsedStartDate = null;
    let parsedEndDate = null;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return sendError(res, 'Ngày bắt đầu (startDate) không hợp lệ.', null, 400);
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return sendError(res, 'Ngày kết thúc (endDate) không hợp lệ.', null, 400);
      }
      // Nếu chuỗi gửi lên chỉ là ngày YYYY-MM-DD hoặc chưa có giờ cuối ngày, chuẩn hóa về cuối ngày 23:59:59.999
      if (typeof endDate === 'string' && !endDate.includes('T')) {
        parsedEndDate.setHours(23, 59, 59, 999);
      } else if (
        parsedEndDate.getHours() === 0 &&
        parsedEndDate.getMinutes() === 0 &&
        parsedEndDate.getSeconds() === 0
      ) {
        parsedEndDate.setHours(23, 59, 59, 999);
      }
    }

    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      return sendError(
        res,
        'Khoảng thời gian không hợp lệ: Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
        null,
        400
      );
    }

    if (parsedStartDate || parsedEndDate) {
      query.timestamp = {};
      if (parsedStartDate) query.timestamp.$gte = parsedStartDate;
      if (parsedEndDate) query.timestamp.$lte = parsedEndDate;
    }

    // Đếm tổng số bản ghi khớp truy vấn
    const totalDocs = await AuditLog.countDocuments(query);

    // Xác định phân trang: Nếu client gửi page hoặc limit thì phân trang server-side
    const isPaginated = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = isPaginated ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : 500;
    const skipNum = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(totalDocs / limitNum) || 1;

    let dbQuery = AuditLog.find(query)
      .populate('actor', 'fullName email role')
      .sort({ timestamp: -1 });

    if (isPaginated) {
      dbQuery = dbQuery.skip(skipNum).limit(limitNum);
    } else {
      dbQuery = dbQuery.limit(limitNum);
    }

    const logs = await dbQuery;

    return sendSuccess(res, 'Lấy danh sách nhật ký kiểm toán (Audit Logs) thành công.', {
      totalRecords: totalDocs,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalDocs,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
};
