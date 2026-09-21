const express = require('express');
const router = express.Router();
const { uploadSingleFile } = require('../controllers/upload.controller');
const { upload } = require('../middlewares/upload.middleware');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Upload 1 file đính kèm (hỗ trợ mọi field name: 'file', 'avatar', 'image', 'photo', 'attachment')
router.post('/', (req, res, next) => {
  upload.any()(req, res, function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Lỗi khi tải file lên.',
      });
    }
    if (!req.file && req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
}, uploadSingleFile);

module.exports = router;
