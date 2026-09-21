const { sendSuccess, sendError, getBaseUrl } = require('../utils/responseHandler');
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../middlewares/upload.middleware');

/**
 * @desc Upload file đính kèm (ảnh minh chứng, đơn nghỉ phép scan, giấy khám bệnh...)
 * @route POST /api/upload
 */
const uploadSingleFile = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!file) {
      return sendError(res, 'Vui lòng chọn file cần tải lên.', null, 400);
    }

    const fileUrl = `/uploads/${file.filename}`;
    const baseUrl = getBaseUrl(req);
    const fullUrl = `${baseUrl}${fileUrl}`;

    return sendSuccess(res, 'Tải lên file thành công.', {
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      fileUrl,
      fullUrl,
      url: fullUrl, // Trả về đường dẫn tuyệt đối cho Mobile App
    }, 201);
  } catch (error) {
    next(error);
  }
};

const downloadFile = (req, res, next) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Không tìm thấy file.', null, 404);
    }
    return res.sendFile(filePath);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadSingleFile,
  downloadFile,
};
