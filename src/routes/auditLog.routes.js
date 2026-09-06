const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLog.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Chỉ Admin mới được tra cứu nhật ký kiểm toán hệ thống
router.get('/', authorizeRoles('admin'), getAuditLogs);

module.exports = router;
