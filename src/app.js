const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// 1. Security Middlewares
app.use(helmet());
app.use(cors());

// 2. Logging & Parsing Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Swagger UI Documentation Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 4. Base Route / Welcome
app.get('/', (req, res) => {
  res.json({
    message: 'Chào mừng đến với API Hệ thống Quản lý Chấm công Trường Đại học',
    swaggerDocs: '/api-docs',
    version: '1.0.0',
  });
});

// 5. Main API Routes
app.use('/api/v1', apiRoutes);

// 6. Error & 404 Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
