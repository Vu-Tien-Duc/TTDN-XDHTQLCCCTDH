const swaggerJsdoc = require('swagger-jsdoc');
const { swaggerPaths, swaggerComponents, swaggerTags } = require('./swaggerPaths');

const port = process.env.PORT || 5000;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hệ thống Quản lý Chấm công Trường Đại học - API Documentation',
      version: '1.0.0',
      description:
        'Hệ thống API RESTful quản lý chấm công, lịch giảng dạy, ca làm việc, đơn nghỉ phép dành cho Giảng viên, Cán bộ Nhân viên và Quản trị viên Trường Đại học.',
      contact: {
        name: 'Đội ngũ Kỹ thuật Hệ thống',
        email: 'admin@university.edu.vn',
      },
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Máy chủ Thử nghiệm (Local Environment)',
      },
    ],
    tags: swaggerTags,
    paths: swaggerPaths,
    components: {
      ...swaggerComponents,
      securitySchemes: {
        ...(swaggerComponents?.securitySchemes || {}),
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập Token JWT dưới dạng: Bearer <token>',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập Token JWT dưới dạng: Bearer <token>',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Hỗ trợ quét thêm JSDoc annotation nếu có
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
