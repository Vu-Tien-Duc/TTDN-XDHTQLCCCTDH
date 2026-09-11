const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const cookieParser = require('cookie-parser');
const swaggerSpec = require('./config/swagger');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// 1. Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
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

// 3. Swagger UI Documentation Route
const swaggerUiOptions = {
  customSiteTitle: 'Tài Liệu API - Hệ Thống Quản Lý Chấm Công',
  swaggerOptions: {
    persistAuthorization: true,
  },
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// 4. Base Route / Welcome
app.get('/', (req, res) => {
  res.json({
    message: 'Chào mừng đến với API Hệ thống Quản lý Chấm công Trường Đại học',
    swaggerDocs: '/api-docs',
    version: '1.0.0',
  });
});

// 5. Main API Routes (Hỗ trợ cả /api và /api/v1)
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// 6. Error & 404 Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
