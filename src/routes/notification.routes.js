const express = require('express');
const router = express.Router();
const { getNotifications } = require('../controllers/notification.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/', verifyToken, getNotifications);

module.exports = router;
