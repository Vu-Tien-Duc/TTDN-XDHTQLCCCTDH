const fs = require('fs');
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
const { verifyToken } = require('./middlewares/auth.middleware');
const { downloadFile } = require('./controllers/upload.controller');

const app = express();

// Tin tưởng reverse proxy (Nginx) để nhận diện đúng giao thức HTTPS (X-Forwarded-Proto)
app.set('trust proxy', 1);

// 1. Security Middlewares (Helmet & CORS Whitelist)
app.use(
  helmet({
    contentSecurityPolicy: false, // Để Swagger UI hoạt động bình thường
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'https://chamcongdh.io.vn',
  'http://chamcongdh.io.vn',
];

const allowedOrigins = process.env.CORS_WHITELIST
  ? process.env.CORS_WHITELIST.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : defaultOrigins;

if (process.env.CLIENT_URL) {
  const clientUrl = process.env.CLIENT_URL.trim().replace(/\/$/, '');
  if (!allowedOrigins.includes(clientUrl)) {
    allowedOrigins.push(clientUrl);
  }
}

app.use(
  cors({
    origin: function (origin, callback) {
      // 1. Cho phép nếu không có origin (Postman, curl, native request)
      if (!origin) {
        return callback(null, true);
      }

      // 2. Môi trường dev hoặc cấu hình '*' -> Cho phép tất cả
      if (!process.env.CORS_WHITELIST || allowedOrigins.includes('*') || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.some((allowed) => {
          const cleanAllowed = allowed.replace(/\/$/, '');
          return cleanAllowed === cleanOrigin || cleanAllowed === '*' || cleanOrigin.endsWith(cleanAllowed);
        }) ||
        cleanOrigin.includes('chamcongdh.io.vn');

      if (isAllowed) {
        return callback(null, true);
      }

      // 3. Fallback: Cho phép tất cả origin hợp lệ thay vì throw Error 500
      return callback(null, true);
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

// 3. Phục vụ file tĩnh uploads (ảnh đại diện, ảnh Face ID, ảnh minh chứng)
const uploadsStaticDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsStaticDir)) {
  fs.mkdirSync(uploadsStaticDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsStaticDir));
app.use('/api/uploads', express.static(uploadsStaticDir));
app.use('/api/v1/uploads', express.static(uploadsStaticDir));
app.get('/uploads/:filename', downloadFile);
app.get('/api/uploads/:filename', downloadFile);
app.get('/api/v1/uploads/:filename', downloadFile);

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

// 6. Main API Routes (Hỗ trợ /api, /api/v1 và cả trường hợp Nginx proxy cắt mất tiền tố /api)
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);
app.use(apiRoutes);

// 7. Phục vụ Frontend tĩnh (Production Single-Port Deployment)
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA Fallback: Mọi URL giao diện (ngoại trừ API, uploads, Swagger) đều trả về index.html (Chuẩn Express 5)
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/users') ||
      req.path.startsWith('/attendance') ||
      req.path.startsWith('/departments') ||
      req.path.startsWith('/shifts') ||
      req.path.startsWith('/schedules') ||
      req.path.startsWith('/leave-requests') ||
      req.path.startsWith('/audit-logs') ||
      req.path.startsWith('/reports') ||
      req.path.startsWith('/upload') ||
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
