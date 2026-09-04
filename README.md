# HỆ THỐNG QUẢN LÝ CHẤM CÔNG CHO TRƯỜNG ĐẠI HỌC - BACKEND NODE.JS

Dự án Backend xây dựng trên nền tảng **Node.js**, **Express**, **MongoDB (Mongoose)** và **Swagger UI** theo kiến trúc **MVC (Model - View/Response - Controller)** nhằm mục đích quản lý chấm công, điểm danh, lịch giảng dạy và đơn xin nghỉ phép dành cho Giảng viên và Cán bộ Nhân viên Trường Đại học.

---

## 🛠 Thư viện cốt lõi đã cài đặt (Core Stack)

- **Web Framework**: [`express`](https://expressjs.com/) (v5.x)
- **Database ODM**: [`mongoose`](https://mongoosejs.com/) (v9.x)
- **API Documentation**: [`swagger-jsdoc`](https://github.com/Swaagie/swagger-jsdoc) & [`swagger-ui-express`](https://github.com/scottie1984/swagger-ui-express)
- **Bảo mật & Middleware**:
  - [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) (Xác thực JWT Token)
  - [`bcryptjs`](https://github.com/dcodeIO/bcrypt.js) (Mã hóa mật khẩu)
  - [`helmet`](https://helmetjs.github.io/) (Bảo mật HTTP Headers)
  - [`cors`](https://github.com/expressjs/cors) (Quản lý Cross-Origin Resource Sharing)
  - [`morgan`](https://github.com/expressjs/morgan) (HTTP Logger)
  - [`dotenv`](https://github.com/motdotla/dotenv) (Quản lý biến môi trường)
- **Dev Tool**: [`nodemon`](https://nodemon.io/) (Tự động khởi động lại server khi thay đổi mã nguồn)

---

## 📂 Khung thư mục MVC (Project Structure)

```text
TTDN-XDHTQLCCCTDH/
├── src/
│   ├── config/
│   │   ├── db.js                 # Cấu hình kết nối MongoDB (Mongoose)
│   │   └── swagger.js            # Cấu hình OpenAPI / Swagger JSDoc
│   ├── controllers/              # Bộ điều hướng xử lý Request / Response
│   │   ├── auth.controller.js        # Xử lý Đăng nhập, Đăng ký, Lấy thông tin cá nhân
│   │   ├── user.controller.js        # Quản lý Giảng viên & Cán bộ nhân viên
│   │   ├── department.controller.js  # Quản lý Khoa, Bộ môn & Phòng ban
│   │   ├── schedule.controller.js    # Quản lý Lịch giảng dạy & Ca công tác
│   │   ├── attendance.controller.js  # Nghiệp vụ Chấm công Check-in / Check-out
│   │   └── leaveRequest.controller.js# Quản lý Đơn xin nghỉ phép / Dạy bù
│   ├── models/                   # Schema Mongoose cho MongoDB
│   │   ├── user.model.js             # Thông tin người dùng (Giảng viên, Admin, Cán bộ)
│   │   ├── department.model.js       # Khoa / Bộ môn / Phòng ban
│   │   ├── schedule.model.js         # Lịch dạy / Lịch công tác
│   │   ├── attendance.model.js       # Bản ghi chấm công (Vị trí, QR, Đúng giờ / Muộn)
│   │   └── leaveRequest.model.js     # Đơn xin nghỉ phép / Dạy bù / Đổi ca
│   ├── routes/                   # Định tuyến API (Endpoints)
│   │   ├── index.js                  # Router tổng hợp & Health Check
│   │   ├── auth.routes.js            # Endpoints xác thực
│   │   ├── user.routes.js            # Endpoints quản lý người dùng
│   │   ├── department.routes.js      # Endpoints phòng ban
│   │   ├── schedule.routes.js        # Endpoints lịch dạy
│   │   ├── attendance.routes.js      # Endpoints chấm công
│   │   └── leaveRequest.routes.js    # Endpoints đơn xin nghỉ
│   ├── middlewares/              # Middlewares hệ thống
│   │   ├── auth.middleware.js        # Xác thực Token JWT & Phân quyền (Roles)
│   │   └── error.middleware.js       # Xử lý lỗi tập trung & 404 Not Found
│   ├── services/                 # Logic nghiệp vụ chi tiết & tính toán
│   │   ├── attendance.service.js     # Tính toán trễ/đúng giờ, tổng hợp công
│   │   └── report.service.js         # Xuất báo cáo chấm công tháng
│   ├── utils/                    # Các tiện ích dùng chung
│   │   └── responseHandler.js        # Standardized API response (Success/Error)
│   ├── app.js                    # Khởi tạo Express app, Swagger UI & Routing
│   └── server.js                 # Entry point khởi chạy Server
├── .env.example                  # File cấu hình biến môi trường mẫu
├── .env                          # File chứa biến môi trường thực tế (Local)
├── .gitignore                    # Bỏ qua node_modules, .env, logs khi commit Git
├── package.json                  # Cấu hình dự án & scripts
└── README.md                     # Tài liệu hướng dẫn dự án
```

---

## ⚙️ Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### 1. Cài đặt các gói phụ thuộc (Dependencies)
```bash
npm install
```

### 2. Cấu hình biến môi trường (.env)
Tạo file `.env` từ file mẫu `.env.example`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/university_attendance_db
JWT_SECRET=super_secret_jwt_key_university_attendance_2026
JWT_EXPIRES_IN=7d
```

### 3. Khởi chạy ứng dụng

- **Môi trường Phát triển (Development with Nodemon)**:
  ```bash
  npm run dev
  ```

- **Môi trường Production (Standard Node)**:
  ```bash
  npm start
  ```

---

## 📖 Tài liệu API Swagger (Swagger UI)

Khi server khởi chạy thành công, truy cập giao diện **Swagger UI** tại:
👉 **[http://localhost:5000/api-docs](http://localhost:5000/api-docs)**

Health Check endpoint:
👉 **[http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)**