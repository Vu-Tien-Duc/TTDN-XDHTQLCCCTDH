const path = require('path');
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

// 3. Static Files Serving (File minh chứng, tài liệu đính kèm)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 4. Swagger UI Documentation Route
const swaggerUiOptions = {
  customSiteTitle: 'Tài Liệu API - Hệ Thống Quản Lý Chấm Công',
  swaggerOptions: {
    persistAuthorization: true,
  },
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// 5. Base Route / Welcome & Health Check
app.get('/', (req, res) => {
  res.json({
    message: 'Chào mừng đến với API Hệ thống Quản lý Chấm công Trường Đại học',
    swaggerDocs: '/api-docs',
    version: '1.0.0',
  });
});

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

// 5. Main API Routes (Hỗ trợ cả /api và /api/v1)
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// 6. Error & 404 Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
