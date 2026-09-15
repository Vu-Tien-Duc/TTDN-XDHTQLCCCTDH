const express = require('express');
const router = express.Router();
const { uploadSingleFile } = require('../controllers/upload.controller');
const { upload } = require('../middlewares/upload.middleware');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Upload 1 file đính kèm với trường form field là 'file' hoặc 'attachment'
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Lỗi khi tải file lên.',
      });
    }
    next();
  });
}, uploadSingleFile);

module.exports = router;
