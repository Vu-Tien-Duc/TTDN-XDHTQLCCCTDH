/**
 * Định nghĩa chi tiết các Endpoints và Schemas cho OpenAPI 3.0 (Swagger UI)
 * Đầy đủ 9 phân hệ chức năng + Health check
 */

const swaggerComponents = {
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Nhập Token JWT (sau khi login tại /api/auth/login) theo định dạng: Bearer <token>',
    },
  },
  schemas: {
    ApiResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Thực hiện thao tác thành công.' },
        data: { type: 'object' },
      },
    },
    User: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25dd8' },
        fullName: { type: 'string', example: 'TS. Trần Thị Bích' },
        email: { type: 'string', example: 'giangvien.bich@university.edu.vn' },
        role: {
          type: 'string',
          enum: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'],
          example: 'giangvien',
        },
        departmentId: { type: 'string', example: '6a9d57378cf3a6165de25dd1' },
        annualLeaveQuota: { type: 'number', example: 12 },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    Department: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25dd1' },
        name: { type: 'string', example: 'Khoa Công nghệ Thông tin' },
        type: { type: 'string', enum: ['khoa', 'bomon', 'phongban'], example: 'khoa' },
        parentId: { type: 'string', nullable: true, example: null },
        managerId: { type: 'string', nullable: true, example: '6a9d57378cf3a6165de25dd7' },
        location: {
          type: 'object',
          properties: {
            lat: { type: 'number', example: 21.028511 },
            lng: { type: 'number', example: 105.854444 },
          },
        },
      },
    },
    ShiftConfig: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25ddc' },
        name: { type: 'string', example: 'Tiết 1-3 (Sáng)' },
        code: { type: 'string', example: 'T1_3' },
        startTime: { type: 'string', example: '07:00' },
        endTime: { type: 'string', example: '09:30' },
        lateThresholdMinutes: { type: 'number', example: 15 },
        earlyLeaveThresholdMinutes: { type: 'number', example: 15 },
        type: { type: 'string', enum: ['tietday', 'hanhchinh'], example: 'tietday' },
        description: { type: 'string', example: 'Ca học buổi sáng tiết 1 đến tiết 3' },
      },
    },
    Schedule: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25de0' },
        userId: { type: 'string', example: '6a9d57378cf3a6165de25dd8' },
        shiftId: { type: 'string', example: '6a9d57378cf3a6165de25ddc' },
        roomId: { type: 'string', example: 'A1-402' },
        weekday: { type: 'integer', description: '0: CN, 1: T2, ..., 6: T7', example: 2 },
        startDate: { type: 'string', format: 'date', example: '2026-01-01' },
        endDate: { type: 'string', format: 'date', example: '2026-12-31' },
        notes: { type: 'string', example: 'Lập trình Web nâng cao - Lớp K21_CNTT' },
      },
    },
    AttendanceLog: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25deb' },
        userId: { type: 'string', example: '6a9d57378cf3a6165de25dd8' },
        shiftId: { type: 'string', example: '6a9d57378cf3a6165de25ddc' },
        scheduleId: { type: 'string', example: '6a9d57378cf3a6165de25de0' },
        checkInTime: { type: 'string', format: 'date-time' },
        checkOutTime: { type: 'string', format: 'date-time', nullable: true },
        status: {
          type: 'string',
          enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'EXCUSED_ABSENCE'],
          example: 'ON_TIME',
        },
        method: { type: 'string', enum: ['GPS', 'QR', 'MANUAL'], example: 'GPS' },
        checkInLocation: {
          type: 'object',
          properties: {
            lat: { type: 'number', example: 21.028511 },
            lng: { type: 'number', example: 105.854444 },
          },
        },
      },
    },
    LeaveRequest: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25dea' },
        userId: { type: 'string', example: '6a9d57378cf3a6165de25dd9' },
        type: {
          type: 'string',
          enum: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om'],
          example: 'nghi_phep',
        },
        startDate: { type: 'string', format: 'date', example: '2026-09-10' },
        endDate: { type: 'string', format: 'date', example: '2026-09-12' },
        reason: { type: 'string', example: 'Bận việc gia đình cá nhân' },
        attachmentUrl: { type: 'string', nullable: true },
        status: {
          type: 'string',
          enum: ['PENDING', 'APPROVED', 'REJECTED'],
          example: 'PENDING',
        },
        approvedBy: { type: 'string', nullable: true },
        approvalNote: { type: 'string', nullable: true },
      },
    },
    AuditLog: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '6a9d57378cf3a6165de25ded' },
        actor: { type: 'string', example: '6a9d57378cf3a6165de25dd6' },
        action: { type: 'string', example: 'USER_LOGIN' },
        targetType: { type: 'string', example: 'User' },
        targetId: { type: 'string', nullable: true },
        ipAddress: { type: 'string', example: '127.0.0.1' },
        timestamp: { type: 'string', format: 'date-time' },
        details: { type: 'object' },
      },
    },
  },
};

const swaggerPaths = {
  // -------------------------------------------------------------
  // SYSTEM & HEALTH CHECK
  // -------------------------------------------------------------
  '/api/health': {
    get: {
      tags: ['3.8 - Hạ Tầng & Kiểm Tra Hệ Thống'],
      summary: 'Kiểm tra trạng thái máy chủ và 8 Collections MongoDB',
      responses: {
        200: {
          description: 'Hệ thống hoạt động bình thường',
          content: {
            'application/json': {
              example: {
                status: 'OK',
                message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
                collectionsCount: 8,
                collections: [
                  'users',
                  'departments',
                  'shift_configs',
                  'schedules',
                  'attendance_logs',
                  'leave_requests',
                  'audit_logs',
                  'refresh_tokens',
                ],
                timestamp: '2026-09-06T12:00:00.000Z',
              },
            },
          },
        },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.1 AUTHENTICATION
  // -------------------------------------------------------------
  '/api/auth/login': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Đăng nhập người dùng (Trả về JWT Access Token & Refresh Token)',
      description: 'Đăng nhập vào hệ thống bằng Email và Mật khẩu. Mặc định mật khẩu các tài khoản demo: password123',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', example: 'daihocdtd@gmail.com' },
                password: { type: 'string', example: 'password123' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Đăng nhập thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Đăng nhập thành công.',
                data: {
                  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  user: {
                    _id: '6a9d57378cf3a6165de25dd6',
                    fullName: 'Quản Trị Viên Hệ Thống (Admin Trường)',
                    email: 'daihocdtd@gmail.com',
                    role: 'admin',
                    departmentId: '6a9d57378cf3a6165de25dd4',
                    annualLeaveQuota: 15,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        401: { description: 'Email hoặc mật khẩu không chính xác' },
      },
    },
  },

  '/api/auth/me': {
    get: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Lấy thông tin cá nhân hiện tại của người dùng đang đăng nhập',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Lấy thông tin thành công',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
            },
          },
        },
        401: { description: 'Chưa xác thực hoặc Token không hợp lệ' },
      },
    },
  },

  '/api/auth/refresh': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Cấp mới Access Token từ Refresh Token (Hỗ trợ Cookie & Request Body)',
      description: 'Hệ thống tự động đọc Refresh Token từ httpOnly cookie hoặc JSON Request Body để cấp mới Access Token 15 phút.',
      security: [],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cấp token mới thành công' },
        400: { description: 'Thiếu Refresh Token trong Cookie hoặc Body' },
        403: { description: 'Refresh token không hợp lệ hoặc đã hết hạn' },
      },
    },
  },

  '/api/auth/logout': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Đăng xuất khỏi hệ thống (Blacklist Access Token, xóa Refresh Token & clear Cookie)',
      description: 'Đưa Access Token hiện tại vào Blacklist để vô hiệu hóa ngay lập tức, xóa Refresh Token trong CSDL và xóa httpOnly cookie.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Đăng xuất thành công' },
      },
    },
  },

  '/api/auth/register': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Đăng ký tài khoản người dùng mới (Gửi mã OTP 6 chữ số qua Email, hạn 10 phút)',
      description: 'Đăng ký tài khoản mới và nhận mã OTP 6 số để kích hoạt tài khoản. Tài khoản ở trạng thái chưa xác minh (isVerified: false).',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fullName', 'email', 'password', 'departmentId'],
              properties: {
                fullName: { type: 'string', example: 'ThS. Nguyễn Văn Mới' },
                email: { type: 'string', example: 'nguyenvanmoi@university.edu.vn' },
                password: { type: 'string', example: 'password123' },
                role: { type: 'string', enum: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'], example: 'giangvien' },
                departmentId: { type: 'string', example: '6a9d57378cf3a6165de25dd1' },
                annualLeaveQuota: { type: 'number', example: 12 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Đăng ký thành công, mã OTP 6 số đã được gửi qua email (hạn 10 phút)' },
        400: { description: 'Thiếu dữ liệu bắt buộc hoặc Email đã được sử dụng' },
      },
    },
  },

  '/api/auth/verify-otp': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Xác minh tài khoản bằng mã OTP (Quá 10 phút -> Xóa tài khoản)',
      description: 'Người dùng nhập mã OTP 6 chữ số nhận từ Email để kích hoạt tài khoản. Nếu quá 10 phút, hệ thống tự động xóa tài khoản và yêu cầu đăng ký lại.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'otp'],
              properties: {
                email: { type: 'string', example: 'nguyenvanmoi@university.edu.vn' },
                otp: { type: 'string', example: '123456' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Xác minh tài khoản thành công, gửi email chúc mừng' },
        400: { description: 'Mã OTP không hợp lệ HOẶC đã hết hạn (quá 10 phút, tài khoản đã bị xóa)' },
        404: { description: 'Không tìm thấy thông tin tài khoản' },
      },
    },
  },

  '/api/auth/forgot-password': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Yêu cầu mã OTP đặt lại mật khẩu (Hạn 10 phút)',
      description: 'Gửi mã OTP 6 chữ số đến email để xác thực yêu cầu đổi mật khẩu mới.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', example: 'daihocdtd@gmail.com' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Mã OTP đặt lại mật khẩu đã được gửi đến email (hạn 10 phút)' },
        400: { description: 'Thiếu email' },
        403: { description: 'Tài khoản chưa được kích hoạt hoặc đã bị vô hiệu hóa' },
        404: { description: 'Không tìm thấy tài khoản với email này' },
      },
    },
  },

  '/api/auth/reset-password': {
    post: {
      tags: ['3.1 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: 'Xác thực OTP và đặt lại mật khẩu mới',
      description: 'Nhập mã OTP 6 số còn hiệu lực (< 10 phút) và mật khẩu mới để đổi mật khẩu (thu hồi các token cũ).',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'otp', 'newPassword'],
              properties: {
                email: { type: 'string', example: 'daihocdtd@gmail.com' },
                otp: { type: 'string', example: '123456' },
                newPassword: { type: 'string', example: 'new_password123' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Đặt lại mật khẩu thành công' },
        400: { description: 'Mã OTP không hợp lệ, đã hết hạn (>10 phút) hoặc mật khẩu dưới 6 ký tự' },
        404: { description: 'Không tìm thấy tài khoản' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.1 USERS MANAGEMENT
  // -------------------------------------------------------------
  '/api/users': {
    get: {
      tags: ['3.1 - Quản Lý Người Dùng (Users)'],
      summary: 'Lấy danh sách người dùng (Admin xem toàn trường, Trưởng khoa chỉ xem khoa mình)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'] }, description: 'Lọc theo chức vụ' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo mã phòng ban (Chỉ có tác dụng với Admin)' },
        { name: 'isActive', in: 'query', schema: { type: 'boolean' }, description: 'Lọc tài khoản còn hoạt động hay không' },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo họ tên hoặc email' },
      ],
      responses: {
        200: { description: 'Lấy danh sách thành công' },
        403: { description: 'Không có quyền truy cập' },
      },
    },
    post: {
      tags: ['3.1 - Quản Lý Người Dùng (Users)'],
      summary: 'Thêm người dùng mới (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fullName', 'email', 'password', 'departmentId'],
              properties: {
                fullName: { type: 'string', example: 'TS. Lê Thanh Sơn' },
                email: { type: 'string', example: 'lethanhson@university.edu.vn' },
                password: { type: 'string', example: 'password123' },
                role: { type: 'string', enum: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'], example: 'giangvien' },
                departmentId: { type: 'string', example: '6a9d57378cf3a6165de25dd1' },
                annualLeaveQuota: { type: 'number', example: 12 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo người dùng thành công' },
        400: { description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại' },
        403: { description: 'Chỉ Admin mới có quyền thực hiện' },
      },
    },
  },

  '/api/users/{id}': {
    get: {
      tags: ['3.1 - Quản Lý Người Dùng (Users)'],
      summary: 'Xem thông tin chi tiết một người dùng',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy thông tin thành công' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
    put: {
      tags: ['3.1 - Quản Lý Người Dùng (Users)'],
      summary: 'Cập nhật thông tin người dùng (Admin / Trưởng khoa)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                fullName: { type: 'string', example: 'TS. Trần Thị Bích (Cập nhật)' },
                departmentId: { type: 'string', example: '6a9d57378cf3a6165de25dd1' },
                role: { type: 'string', enum: ['admin', 'truongkhoa', 'giangvien', 'nhanvien'] },
                isActive: { type: 'boolean' },
                annualLeaveQuota: { type: 'number', example: 14 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
    delete: {
      tags: ['3.1 - Quản Lý Người Dùng (Users)'],
      summary: 'Vô hiệu hóa người dùng (Soft Delete: isActive = false) (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Vô hiệu hóa tài khoản thành công' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.2 DEPARTMENTS
  // -------------------------------------------------------------
  '/api/departments': {
    get: {
      tags: ['3.2 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: 'Lấy danh sách Khoa / Viện / Phòng ban (Cây phân cấp)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'tree', in: 'query', schema: { type: 'boolean', default: true }, description: 'Trả về cấu trúc dạng cây phân cấp (true/false)' },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['khoa', 'bomon', 'phongban'] }, description: 'Lọc theo loại' },
        { name: 'parentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID đơn vị cha' },
      ],
      responses: {
        200: { description: 'Lấy danh sách thành công' },
      },
    },
    post: {
      tags: ['3.2 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: 'Tạo mới Khoa / Phòng ban / Bộ môn (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'type'],
              properties: {
                name: { type: 'string', example: 'Bộ môn Khoa học Dữ liệu' },
                type: { type: 'string', enum: ['khoa', 'bomon', 'phongban'], example: 'bomon' },
                parentId: { type: 'string', example: '6a9d57378cf3a6165de25dd1', nullable: true },
                managerId: { type: 'string', example: '6a9d57378cf3a6165de25dd7', nullable: true },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo đơn vị thành công' },
        400: { description: 'Thiếu thông tin bắt buộc hoặc vi phạm quy tắc phân cấp / managerId không hợp lệ' },
      },
    },
  },

  '/api/departments/{id}': {
    get: {
      tags: ['3.2 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: 'Lấy chi tiết Khoa / Phòng ban',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy chi tiết thành công' },
        404: { description: 'Không tìm thấy phòng ban' },
      },
    },
    put: {
      tags: ['3.2 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: 'Cập nhật thông tin Khoa / Phòng ban (Admin / Trưởng khoa)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Khoa CNTT & Truyền thông' },
                managerId: { type: 'string', example: '6a9d57378cf3a6165de25dd7' },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
      },
    },
    delete: {
      tags: ['3.2 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: 'Xóa Khoa / Phòng ban (Ràng buộc nhân sự & đơn vị con) (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Xóa thành công' },
        400: { description: 'Không thể xóa do còn nhân sự hoặc đơn vị con trực thuộc' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.3 SHIFT CONFIGS
  // -------------------------------------------------------------
  '/api/shifts': {
    get: {
      tags: ['3.3 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: 'Danh sách cấu hình ca làm việc / tiết học',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Lấy danh sách thành công' },
      },
    },
    post: {
      tags: ['3.3 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: 'Thêm mới ca làm việc / tiết dạy (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'code', 'startTime', 'endTime'],
              properties: {
                name: { type: 'string', example: 'Tiết 10-12 (Tối)' },
                code: { type: 'string', example: 'T10_12' },
                startTime: { type: 'string', example: '18:00' },
                endTime: { type: 'string', example: '20:30' },
                lateThresholdMinutes: { type: 'number', default: 15, example: 15 },
                earlyLeaveThresholdMinutes: { type: 'number', default: 15, example: 15 },
                type: { type: 'string', enum: ['tietday', 'hanhchinh'], example: 'tietday' },
                description: { type: 'string', example: 'Ca học buổi tối' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo ca làm việc thành công' },
      },
    },
  },

  '/api/shifts/{id}': {
    get: {
      tags: ['3.3 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: 'Chi tiết ca làm việc theo ID',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy chi tiết thành công' },
        404: { description: 'Không tìm thấy ca làm việc' },
      },
    },
    put: {
      tags: ['3.3 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: 'Cập nhật ca làm việc (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                startTime: { type: 'string', example: '07:15' },
                endTime: { type: 'string', example: '09:45' },
                lateThresholdMinutes: { type: 'number' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
      },
    },
    delete: {
      tags: ['3.3 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: 'Xóa ca làm việc (Chỉ Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Xóa thành công' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.3 SCHEDULES
  // -------------------------------------------------------------
  '/api/schedules': {
    get: {
      tags: ['3.3 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: 'Tra cứu lịch giảng dạy và lịch làm việc',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID giảng viên' },
        { name: 'shiftId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID ca' },
        { name: 'weekday', in: 'query', schema: { type: 'integer' }, description: 'Thứ trong tuần (0: CN, 1: T2, ..., 6: T7)' },
        { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Lọc lịch học vào ngày cụ thể (YYYY-MM-DD)' },
      ],
      responses: {
        200: { description: 'Lấy danh sách lịch thành công' },
      },
    },
    post: {
      tags: ['3.3 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: 'Tạo mới lịch phân công giảng dạy (Admin / Trưởng khoa)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'shiftId', 'roomId', 'weekday', 'startDate', 'endDate'],
              properties: {
                userId: { type: 'string', example: '6a9d57378cf3a6165de25dd8' },
                shiftId: { type: 'string', example: '6a9d57378cf3a6165de25ddc' },
                roomId: { type: 'string', example: 'A1-402' },
                weekday: { type: 'integer', example: 2 },
                startDate: { type: 'string', format: 'date', example: '2026-09-01' },
                endDate: { type: 'string', format: 'date', example: '2026-12-31' },
                notes: { type: 'string', example: 'Hệ điều hành nâng cao - K21' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo lịch phân công thành công' },
        400: { description: 'Xung đột lịch giảng dạy hoặc dữ liệu thiếu' },
      },
    },
  },

  '/api/schedules/{id}': {
    get: {
      tags: ['3.3 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: 'Xem chi tiết một lịch giảng dạy',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy thông tin thành công' },
      },
    },
    put: {
      tags: ['3.3 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: 'Cập nhật lịch giảng dạy (Admin / Trưởng khoa)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                roomId: { type: 'string', example: 'B2-205' },
                notes: { type: 'string', example: 'Chuyển phòng học thực hành' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
      },
    },
    delete: {
      tags: ['3.3 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: 'Xóa lịch giảng dạy (Admin / Trưởng khoa)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Xóa thành công' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.4 ATTENDANCE
  // -------------------------------------------------------------
  '/api/attendance/check-in': {
    post: {
      tags: ['3.4 - Quản Lý Chấm Công (Attendance)'],
      summary: 'Điểm danh đầu ca (Check-in GPS / QR / Manual)',
      description: 'Hệ thống tự động tìm lịch dạy phù hợp của người dùng trong khoảng [startTime - 30p, endTime] và đánh giá trạng thái Đúng giờ / Đi muộn.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                method: { type: 'string', enum: ['GPS', 'QR', 'MANUAL'], default: 'GPS', example: 'GPS' },
                deviceId: { type: 'string', example: 'BROWSER-CHROME-122' },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Điểm danh Check-in thành công' },
        400: { description: 'Đã check-in ca này rồi hoặc không có lịch phù hợp trong khung giờ hiện tại' },
      },
    },
  },

  '/api/attendance/check-out': {
    post: {
      tags: ['3.4 - Quản Lý Chấm Công (Attendance)'],
      summary: 'Điểm danh kết thúc ca (Check-out)',
      description: 'Tự động tìm kiếm bản ghi check-in mở gần nhất trong ngày để đóng ca và cập nhật thời gian check-out.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Điểm danh Check-out thành công' },
        404: { description: 'Không tìm thấy lượt check-in mở nào trong ngày' },
      },
    },
  },

  '/api/attendance/history': {
    get: {
      tags: ['3.4 - Quản Lý Chấm Công (Attendance)'],
      summary: 'Lịch sử chấm công (Phân quyền: Giảng viên chỉ xem của mình, Trưởng khoa xem khoa mình, Admin xem tất cả)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo nhân sự' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo phòng ban' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'EXCUSED_ABSENCE'] }, description: 'Lọc theo trạng thái' },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Từ ngày (YYYY-MM-DD)' },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Đến ngày (YYYY-MM-DD)' },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Số trang' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Số bản ghi / trang' },
      ],
      responses: {
        200: { description: 'Lấy lịch sử chấm công thành công' },
      },
    },
  },

  '/api/attendance/{id}': {
    get: {
      tags: ['3.4 - Quản Lý Chấm Công (Attendance)'],
      summary: 'Xem chi tiết bản ghi chấm công',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy thông tin thành công' },
      },
    },
    put: {
      tags: ['3.4 - Quản Lý Chấm Công (Attendance)'],
      summary: 'Điều chỉnh bản ghi chấm công (Chỉ Admin - Có ghi Audit Log)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                status: { type: 'string', enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'EXCUSED_ABSENCE'], example: 'ON_TIME' },
                checkInTime: { type: 'string', format: 'date-time' },
                checkOutTime: { type: 'string', format: 'date-time' },
                reason: { type: 'string', example: 'Điều chỉnh bổ sung do giảng viên quên quẹt thẻ có sự xác nhận' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Điều chỉnh chấm công thành công' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.5 LEAVE REQUESTS
  // -------------------------------------------------------------
  '/api/leave-requests': {
    post: {
      tags: ['3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: 'Tạo đơn xin nghỉ phép / dạy bù / đổi ca',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['type', 'reason', 'startDate', 'endDate'],
              properties: {
                type: { type: 'string', enum: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om'], example: 'nghi_phep' },
                startDate: { type: 'string', format: 'date', example: '2026-09-15' },
                endDate: { type: 'string', format: 'date', example: '2026-09-17' },
                reason: { type: 'string', example: 'Đi tham dự hội thảo khoa học quốc tế' },
                attachmentUrl: { type: 'string', example: 'https://cdn.university.edu.vn/giay-moi-hoi-thao.pdf' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Gửi đơn thành công' },
        400: { description: 'Thiếu dữ liệu hoặc ngày kết thúc trước ngày bắt đầu' },
      },
    },
    get: {
      tags: ['3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: 'Danh sách đơn xin nghỉ phép (Phân quyền theo vai trò)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] }, description: 'Lọc trạng thái' },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om'] }, description: 'Lọc loại đơn' },
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID người làm đơn' },
      ],
      responses: {
        200: { description: 'Lấy danh sách đơn thành công' },
      },
    },
  },

  '/api/leave-requests/balance': {
    get: {
      tags: ['3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: 'Xem số ngày phép còn lại trong năm (Leave Balance)',
      description: 'Dùng Aggregate pipeline tính tổng ngày phép tiêu chuẩn, ngày đã sử dụng và ngày còn lại.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'ID người dùng cần tra cứu (Mặc định là chính mình)' },
      ],
      responses: {
        200: {
          description: 'Tính toán hạn mức phép thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy thông tin số ngày phép thành công.',
                data: {
                  userId: '6a9d57378cf3a6165de25dd8',
                  year: 2026,
                  quota: 12,
                  usedDays: 3,
                  remainingDays: 9,
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/leave-requests/{id}': {
    get: {
      tags: ['3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: 'Xem chi tiết một đơn xin nghỉ',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy chi tiết thành công' },
        404: { description: 'Không tìm thấy đơn' },
      },
    },
  },

  '/api/leave-requests/{id}/approve': {
    put: {
      tags: ['3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: 'Phê duyệt đơn xin nghỉ (Trưởng khoa / Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                approvalNote: { type: 'string', example: 'Đồng ý cho nghỉ phép, khoa đã bố trí giảng viên dạy thay.' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Duyệt đơn thành công' },
      },
    },
  },

  '/api/leave-requests/{id}/reject': {
    put: {
      tags: ['3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: 'Từ chối đơn xin nghỉ (Trưởng khoa / Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                approvalNote: { type: 'string', example: 'Trùng lịch thi kết thúc học phần, đề nghị chọn ngày khác.' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Từ chối đơn thành công' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.6 AUDIT LOGS
  // -------------------------------------------------------------
  '/api/audit-logs': {
    get: {
      tags: ['3.6 - Nhật Ký Kiểm Toán An Toàn (Audit Logs)'],
      summary: 'Tra cứu nhật ký kiểm toán hệ thống (Chỉ dành cho Admin)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'actor', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID người thao tác' },
        { name: 'action', in: 'query', schema: { type: 'string' }, description: 'Lọc theo hành động (USER_LOGIN, ATTENDANCE_CHECKIN, ...)' },
        { name: 'targetType', in: 'query', schema: { type: 'string' }, description: 'Lọc theo đối tượng (User, AttendanceLog, ...)' },
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Từ ngày' },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Đến ngày' },
      ],
      responses: {
        200: { description: 'Lấy danh sách nhật ký thành công' },
        403: { description: 'Không có quyền truy cập (yêu cầu quyền Admin)' },
      },
    },
  },

  // -------------------------------------------------------------
  // 3.7 REPORTS
  // -------------------------------------------------------------
  '/api/reports/attendance': {
    get: {
      tags: ['3.7 - Báo Cáo & Thống Kê (Reports)'],
      summary: 'Báo cáo tổng hợp số liệu chấm công và ngày phép',
      description: 'Thống kê tổng số ca, số lượt đúng giờ, đi muộn, về sớm, vắng mặt và số ngày nghỉ phép đã duyệt trong kỳ.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo giảng viên / nhân viên' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo khoa / phòng ban' },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Từ ngày (YYYY-MM-DD)' },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Đến ngày (YYYY-MM-DD)' },
      ],
      responses: {
        200: {
          description: 'Lấy báo cáo thống kê thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy báo cáo thống kê chấm công thành công.',
                data: {
                  totalRecords: 15,
                  onTimeCount: 12,
                  lateCount: 2,
                  earlyLeaveCount: 1,
                  absentCount: 0,
                  excusedAbsenceCount: 0,
                  approvedLeaveDays: 2,
                },
              },
            },
          },
        },
      },
    },
  },
};

const swaggerTags = [
  { name: '3.8 - Hạ Tầng & Kiểm Tra Hệ Thống', description: 'Kiểm tra trạng thái máy chủ và kết nối CSDL MongoDB' },
  { name: '3.1 - Xác Thực & Phiên Làm Việc (Auth)', description: 'Đăng nhập, cấp mới Token JWT và phân quyền' },
  { name: '3.1 - Quản Lý Người Dùng (Users)', description: 'Quản lý thông tin giảng viên, nhân viên, phân quyền' },
  { name: '3.2 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)', description: 'Quản lý cây đơn vị Trường > Khoa > Bộ môn/Phòng ban' },
  { name: '3.3 - Ca Làm Việc & Tiết Học (Shifts)', description: 'Định nghĩa khung giờ tiết học, ca hành chính và ngưỡng đi muộn/về sớm' },
  { name: '3.3 - Lịch Phân Công Giảng Dạy (Schedules)', description: 'Thời khóa biểu, lịch giảng dạy và công tác' },
  { name: '3.4 - Quản Lý Chấm Công (Attendance)', description: 'Check-in, Check-out tự động khớp ca, lịch sử điểm danh' },
  { name: '3.5 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)', description: 'Quy trình tạo đơn, tính hạn mức nghỉ phép (balance) và phê duyệt' },
  { name: '3.6 - Nhật Ký Kiểm Toán An Toàn (Audit Logs)', description: 'Lưu vết lịch sử thao tác quan trọng để giám sát' },
  { name: '3.7 - Báo Cáo & Thống Kê (Reports)', description: 'Thống kê tổng hợp số giờ dạy, đi muộn, nghỉ phép' },
];

module.exports = {
  swaggerPaths,
  swaggerComponents,
  swaggerTags,
};
