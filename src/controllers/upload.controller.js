const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * @desc Upload file đính kèm (ảnh minh chứng, đơn nghỉ phép scan, giấy khám bệnh...)
 * @route POST /api/upload
 */
const uploadSingleFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 'Vui lòng chọn file cần tải lên.', null, 400);
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    return sendSuccess(res, 'Tải lên file thành công.', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fileUrl,
    }, 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadSingleFile,
};
