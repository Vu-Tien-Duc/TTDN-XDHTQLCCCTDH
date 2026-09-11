const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLog.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Chỉ Admin mới được tra cứu nhật ký kiểm toán hệ thống
router.get('/', verifyRole(['admin']), getAuditLogs);

module.exports = router;
