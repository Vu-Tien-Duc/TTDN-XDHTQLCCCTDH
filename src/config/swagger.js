const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hệ thống Quản lý Chấm công Trường Đại học - API Documentation',
      version: '1.0.0',
      description: 'Hệ thống API quản lý chấm công, lịch dạy, đơn nghỉ phép dành cho Giảng viên và Cán bộ Nhân viên Trường Đại học.',
      contact: {
        name: 'Đội ngũ Phát triển Hệ thống',
        email: 'admin@university.edu.vn',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 27017}`,
        description: 'Máy chủ Thử nghiệm (Local Environment)',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
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
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Đường dẫn quét các annotation Swagger
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
