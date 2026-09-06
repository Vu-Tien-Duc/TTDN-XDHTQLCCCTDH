# HỆ THỐNG QUẢN LÝ CHẤM CÔNG CHO TRƯỜNG ĐẠI HỌC - BACKEND NODE.JS

Dự án Backend xây dựng trên nền tảng **Node.js**, **Express 5**, **MongoDB (Mongoose 9)** và **Swagger UI** theo kiến trúc **Layered MVC (Model - Controller - Route - Service)** phục vụ nghiệp vụ quản lý chấm công, lịch giảng dạy/công tác, đơn xin nghỉ phép và báo cáo thống kê dành cho Giảng viên và Cán bộ Nhân viên Trường Đại học.

---

## 🛠 Công nghệ cốt lõi (Core Stack)

- **Web Framework**: [`express`](https://expressjs.com/) (v5.x)
- **Database ODM**: [`mongoose`](https://mongoosejs.com/) (v9.x)
- **API Documentation**: [`swagger-jsdoc`](https://github.com/Swaagie/swagger-jsdoc) & [`swagger-ui-express`](https://github.com/scottie1984/swagger-ui-express)
- **Bảo mật & Middleware**:
  - [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) (Xác thực JWT Token: Access Token + Refresh Token)
  - [`bcryptjs`](https://github.com/dcodeIO/bcrypt.js) (Mã hóa mật khẩu chi phí cao cost 12)
  - [`helmet`](https://helmetjs.github.io/) (Bảo mật HTTP Headers)
  - [`cors`](https://github.com/expressjs/cors) (Quản lý Cross-Origin Resource Sharing)
  - [`morgan`](https://github.com/expressjs/morgan) (HTTP Logger)
  - [`dotenv`](https://github.com/motdotla/dotenv) (Quản lý biến môi trường)
- **Dev Tool**: [`nodemon`](https://nodemon.io/) (Tự động tải lại mã nguồn khi phát triển)

---

## 🗄 Danh mục 8 Collections MongoDB Chuẩn

1. **`users`**: Quản lý tài khoản (Admin, Trưởng khoa, Giảng viên, Nhân viên), mật khẩu mã hóa bcrypt cost 12, hạn mức nghỉ phép năm `annualLeaveQuota`.
2. **`departments`**: Cơ cấu tổ chức phân cấp (Trường > Khoa > Bộ môn / Phòng ban), quản lý bởi `managerId`.
3. **`shift_configs`**: Danh mục các ca làm việc chuẩn (Giờ bắt đầu/kết thúc, ngưỡng trễ).
4. **`schedules`**: Lịch phân công giảng dạy/công tác theo học kỳ (Compound index: `{ userId: 1, weekday: 1, startDate: 1, endDate: 1 }`).
5. **`attendance_logs`**: Nhật ký chấm công, tự động suy luận ca từ giờ thực tế, cờ `isManualOverride` & `method = admin_override`.
6. **`leave_requests`**: Đơn xin nghỉ phép, dạy bù, đổi ca (Compound index: `{ userId: 1, status: 1, type: 1 }`).
7. **`audit_logs`**: Nhật ký kiểm toán truy vết các thao tác nhạy cảm (duyệt đơn, điều chỉnh log chấm công).
8. **`refresh_tokens`**: Quản lý phiên đăng nhập và thu hồi token, tự hủy với TTL Index `{ expiresAt: 1 }`.

---

## 📂 Cấu trúc thư mục (Project Structure)

```text
TTDN-XDHTQLCCCTDH/
├── requests.http                 # File test trực tiếp bằng VS Code REST Client / Thunder Client
├── postman_collection.json       # File Postman Collection v2.1 import vào Postman
├── API_DOCUMENTATION.md          # Tài liệu chi tiết 37 endpoints dùng cho báo cáo đồ án
├── src/
│   ├── config/
│   │   ├── db.js                 # Kết nối MongoDB (Mongoose)
│   │   └── swagger.js            # Cấu hình OpenAPI / Swagger Docs
│   ├── controllers/              # Điều hướng logic nghiệp vụ
│   │   ├── auth.controller.js        # Đăng nhập, Đăng ký, Refresh Token, Logout, Me
│   │   ├── user.controller.js        # Quản lý người dùng & Soft delete
│   │   ├── department.controller.js  # Quản lý đơn vị tổ chức dạng cây
│   │   ├── shiftConfig.controller.js # Quản lý danh mục ca làm việc (Shifts)
│   │   ├── schedule.controller.js    # Phân lịch & Kiểm tra chống trùng giờ
│   │   ├── attendance.controller.js  # Chấm công Check-in / Check-out tự động
│   │   ├── leaveRequest.controller.js# Quản lý nghỉ phép & Tính số ngày phép động
│   │   ├── auditLog.controller.js    # Tra cứu nhật ký kiểm toán (Admin)
│   │   └── report.controller.js      # Báo cáo thống kê tổng hợp
│   ├── models/                   # Đúng chuẩn 8 Collections Mongoose
│   │   ├── user.model.js             # Collection: users
│   │   ├── department.model.js       # Collection: departments
│   │   ├── shiftConfig.model.js      # Collection: shift_configs
│   │   ├── schedule.model.js         # Collection: schedules
│   │   ├── attendanceLog.model.js    # Collection: attendance_logs
│   │   ├── leaveRequest.model.js     # Collection: leave_requests
│   │   ├── auditLog.model.js         # Collection: audit_logs
│   │   └── refreshToken.model.js     # Collection: refresh_tokens
│   ├── routes/                   # Định tuyến API (Endpoints)
│   │   ├── index.js                  # Router tổng hợp
│   │   ├── auth.routes.js            # /api/auth
│   │   ├── user.routes.js            # /api/users
│   │   ├── department.routes.js      # /api/departments
│   │   ├── shiftConfig.routes.js     # /api/shifts & /api/shift-configs
│   │   ├── schedule.routes.js        # /api/schedules
│   │   ├── attendance.routes.js      # /api/attendance
│   │   ├── leaveRequest.routes.js    # /api/leave-requests
│   │   ├── auditLog.routes.js        # /api/audit-logs
│   │   └── report.routes.js          # /api/reports
│   ├── middlewares/              # Xác thực JWT & Bắt lỗi hệ thống
│   │   ├── auth.middleware.js        # verifyToken, authorizeRoles
│   │   └── error.middleware.js       # errorHandler, notFoundHandler
│   ├── services/                 # Helper tính toán logic
│   │   ├── attendance.service.js     # Tính toán trạng thái ON_TIME/LATE theo ca
│   │   └── report.service.js         # Thống kê báo cáo tháng
│   └── utils/
│       ├── responseHandler.js        # Chuẩn hóa format JSON phản hồi
│       └── seeder.js                 # Script nạp dữ liệu mẫu vào CSDL
├── .env.example
├── package.json
└── server.js
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy thử nghiệm

### 1. Khởi tạo dữ liệu mẫu (Seed Data)
Để nạp sẵn 1 Admin, 1 Trưởng khoa, 3 Giảng viên, 1 Nhân viên, các phòng ban, ca làm việc, lịch dạy hôm nay và đơn nghỉ phép mẫu, chạy:
```bash
npm run seed
```

### 2. Danh sách tài khoản thử nghiệm:
| Vai trò | Email | Mật khẩu | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@university.edu.vn` | `password123` | Toàn quyền quản trị hệ thống |
| **Trưởng Khoa** | `truongkhoa.cntt@university.edu.vn` | `password123` | Quản lý nhân sự Khoa CNTT |
| **Giảng Viên 1** | `giangvien.bich@university.edu.vn` | `password123` | Có lịch dạy hôm nay, đã duyệt nghỉ 3 ngày |
| **Giảng Viên 2** | `giangvien.cuong@university.edu.vn` | `password123` | Có đơn xin nghỉ đang chờ duyệt (PENDING) |
| **Giảng Viên 3** | `giangvien.linh@university.edu.vn` | `password123` | Giảng viên Khoa CNTT |
| **Nhân Viên** | `nhanvien.ha@university.edu.vn` | `password123` | Chuyên viên Phòng Đào tạo |

### 3. Chạy Server
```bash
# Môi trường phát triển
npm run dev

# Môi trường production
npm start
```

### 4. Kiểm thử API
- **Swagger UI**: Truy cập trình duyệt tại `http://localhost:5000/api-docs`
- **VS Code**: Mở file [`requests.http`](file:///d:/Th%E1%BB%B1c%20t%E1%BA%ADp%20t%E1%BB%91t%20nghi%C3%AAp/project/TTDN-XDHTQLCCCTDH/requests.http) và bấm `Send Request`
- **Postman**: Import file [`postman_collection.json`](file:///d:/Th%E1%BB%B1c%20t%E1%BA%ADp%20t%E1%BB%91t%20nghi%C3%AAp/project/TTDN-XDHTQLCCCTDH/postman_collection.json)