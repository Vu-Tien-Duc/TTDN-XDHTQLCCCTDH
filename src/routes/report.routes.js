const express = require('express');
const router = express.Router();
const { getAttendanceReport } = require('../controllers/report.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/attendance', getAttendanceReport);

module.exports = router;
