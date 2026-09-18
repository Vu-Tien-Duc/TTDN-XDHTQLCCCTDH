const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

let cookieParser;
try {
  cookieParser = require('cookie-parser');
} catch (e) {
  cookieParser = () => (req, res, next) => {
    req.cookies = {};
    if (req.headers && req.headers.cookie) {
      req.headers.cookie.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        if (parts.length >= 2) {
          req.cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
        }
      });
    }
    next();
  };
}

const swaggerSpec = require('./config/swagger');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { verifyToken } = require('./middlewares/auth.middleware');
const { downloadFile } = require('./controllers/upload.controller');

const app = express();

// 1. Security Middlewares (Helmet & CORS Whitelist)
app.use(
  helmet({
    contentSecurityPolicy: false, // Để Swagger UI hoạt động bình thường
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = process.env.CORS_WHITELIST
  ? process.env.CORS_WHITELIST.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500', 'http://localhost:5000'];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Truy cập bị chặn bởi chính sách CORS Whitelist của máy chủ.'));
      }
    },
    credentials: true,
  })
);

// 2. Logging & Parsing Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. File minh chứng chỉ được tải xuống sau khi xác thực
app.get('/uploads/:filename', verifyToken, downloadFile);

// 4. Swagger UI Documentation Route
const swaggerUiOptions = {
  customSiteTitle: 'Tài Liệu API - Hệ Thống Quản Lý Chấm Công',
  swaggerOptions: {
    persistAuthorization: true,
  },
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// 5. Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    collectionsCount: 9,
    collections: [
      'users',
      'departments',
      'shift_configs',
      'schedules',
      'attendance_logs',
      'leave_requests',
      'audit_logs',
      'refresh_tokens',
      'token_blacklists',
    ],
    timestamp: new Date().toISOString(),
  });
});

// 6. Main API Routes (Hỗ trợ cả /api và /api/v1)
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// 7. Phục vụ Frontend tĩnh (Production Single-Port Deployment)
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA Fallback: Mọi URL giao diện (ngoại trừ API, uploads, Swagger) đều trả về index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/api-docs') ||
      req.path.startsWith('/health')
    ) {
      return next();
    }
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    next();
  });
} else {
  // Khi chưa build frontend (môi trường dev chỉ chạy backend)
  app.get('/', (req, res) => {
    res.json({
      message: 'Chào mừng đến với API Hệ thống Quản lý Chấm công Trường Đại học',
      swaggerDocs: '/api-docs',
      version: '1.0.0',
    });
  });
}

// 6. Error & 404 Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
