# 🎓 HỆ THỐNG QUẢN LÝ CHẤM CÔNG CÁN BỘ, GIẢNG VIÊN TRƯỜNG ĐẠI HỌC

> **Đề tài:** Xây dựng hệ thống quản lý chấm công, lịch giảng dạy và công tác cho cán bộ, giảng viên trường đại học  
> **Nền tảng:** Web Application & Smart Kiosk Attendance System  
> **Repository:** [https://github.com/Vu-Tien-Duc/TTDN-XDHTQLCCCTDH](https://github.com/Vu-Tien-Duc/TTDN-XDHTQLCCCTDH)

---

## 📌 1. Giới Thiệu Tổng Quan

Trong bối cảnh chuyển đổi số giáo dục đại học, công tác quản lý thời gian giảng dạy, chấm công và giải quyết đơn từ hành chính của cán bộ, giảng viên đòi hỏi sự chính xác, minh bạch và tức thời. Hệ thống **Quản Lý Chấm Công Trường Đại Học** được xây dựng nhằm giải quyết toàn diện các bài toán nghiệp vụ đặc thù trong môi trường sư phạm:

- **Chấm công linh hoạt & đa phương thức**: Hỗ trợ chấm công thông qua **Kiosk AI Nhận diện khuôn mặt (FaceID)**, định vị GPS trong khuôn viên giảng đường (Geofencing Campus Map) và ghi nhận ca dạy theo thời khóa biểu.
- **Phân cấp quản lý chuẩn mực (RBAC 4 cấp)**: Tách bạch thẩm quyền giữa *Quản trị viên (Admin)*, *Trưởng khoa/Viện trưởng*, *Giảng viên* và *Chuyên viên hành chính*.
- **Tự động hóa luồng phê duyệt**: Quy trình nộp đơn xin nghỉ phép, xin dạy bù, đổi ca giảng dạy liên thông trực tiếp với bảng điểm danh và cập nhật số dư phép năm theo thời gian thực.
- **Trợ lý AI thông minh**: Ứng dụng mô hình ngôn ngữ lớn (Google Gemini LLM) kết hợp động cơ phân tích dữ liệu chuyên sâu (Augmented Analytics) giúp giải đáp thắc mắc về lịch dạy, phép năm và thống kê chuyên cần bằng ngôn ngữ tự nhiên.

---

## 🛠️ 2. Ngăn Xếp Công Nghệ (Tech Stack)

Hệ thống được phát triển theo kiến trúc hướng dịch vụ (Service-Oriented Architecture), phân tách độc lập giữa Backend API và Frontend SPA hiện đại:

### ⚙️ Backend Core
| Công nghệ | Phiên bản / Thư viện | Vai trò |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v20+ LTS) | Môi trường thực thi JavaScript phía Server |
| **Web Framework** | Express.js 5 | Xây dựng RESTful API, Routing, Error Handling |
| **Database** | MongoDB & Mongoose ODM | Lưu trữ CSDL NoSQL linh hoạt, tối ưu Aggregation Pipelines & Compound Indexes |
| **Xác thực & Bảo mật** | JWT, bcryptjs, Helmet, CORS, Rate Limit | Xác thực token kép (Access/Refresh), mã hóa mật khẩu, chống Brute-force & NoSQL Injection |
| **Tác vụ nền & Lịch trình** | node-cron | Tự động quét ca dạy và đánh vắng (`ABSENT`) khi hết thời hạn điểm danh |
| **Giao tiếp Email** | Nodemailer | Gửi mã xác thực OTP khôi phục mật khẩu, thông báo phê duyệt đơn phép |
| **Tài liệu hóa API** | Swagger UI Express | Cung cấp tài liệu API tương tác trực quan (`/api-docs`) |

### 💻 Frontend & Kiosk Client
| Công nghệ | Phiên bản / Thư viện | Vai trò |
| :--- | :--- | :--- |
| **UI Framework** | React 19 (TypeScript) | Xây dựng giao diện người dùng reactive, type-safe và module hóa |
| **Build Tool** | Vite | Tốc độ dev server tức thì (HMR) và tối ưu bundle build siêu nhỏ gọn |
| **Styling** | TailwindCSS + Lucide Icons | Thiết kế giao diện hiện đại, chuẩn UI/UX, hỗ trợ Dark/Light Theme mượt mà |
| **Xử lý thị giác máy tính** | HTML5 Canvas + Web Worker | Kiosk điểm danh khuôn mặt tối ưu hiệu năng không làm đơ giao diện chính |
| **Quản lý Form** | React Hook Form & Zod | Quản lý form hiệu quả, validate dữ liệu đầu vào nghiêm ngặt từ Client |
| **State & HTTP** | Axios Interceptors + Context API | Xử lý refresh token tự động ngầm (silent refresh) và quản lý phiên người dùng |
| **Báo cáo & Xuất dữ liệu** | SheetJS (`xlsx`) + Native Print PDF | Xuất bảng tổng hợp chấm công định dạng Excel và in phiếu thống kê |

---

## 🌟 3. Các Phân Hệ & Tính Năng Cốt Lõi

```
┌────────────────────────────────────────────────────────────────────────┐
│               HỆ THỐNG QUẢN LÝ CHẤM CÔNG ĐẠI HỌC                       │
├──────────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│ 🔐 XÁC THỰC  │ 🏢 TỔ CHỨC   │ 📅 LỊCH DẠY  │ 📸 ĐIỂM DANH│ 📝 ĐƠN TỪ   │
│ & PHÂN QUYỀN │ & NHÂN SỰ    │ & CA LÀM     │ ĐA KÊNH     │ & NGHỈ PHÉP │
├──────────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ • JWT + OTP  │ • Cây tổ     │ • Ca học     │ • Kiosk AI  │ • Phép năm  │
│ • Silent     │   chức Khoa/ │   Sáng/Chiều │   FaceID    │ • Dạy bù    │
│   Refresh    │   Bộ môn     │ • Chặn trùng │ • Định vị   │ • Duyệt đa  │
│ • RBAC 4 cấp │ • Quản lý hồ │   phòng/lịch │   GPS       │   cấp Khoa/ │
│ • Audit Log  │   sơ cán bộ  │ • Lịch tuần  │ • Cron vắng │   Trường    │
└──────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
```

### 🔐 1. Xác thực, Bảo mật & Phân quyền (RBAC)
- [x] **Cơ chế Token Kép**: Cấp phát `accessToken` (15 phút) và `refreshToken` (7 ngày) qua HTTP-only cookie, tự động gia hạn phiên làm việc không làm gián đoạn người dùng.
- [x] **Thu hồi phiên làm việc (Token Blacklist)**: Đăng xuất chủ động vô hiệu hóa token ngay lập tức trong Redis/MongoDB.
- [x] **Bảo vệ chống Brute-force**: Rate limiting 5 lần đăng nhập sai/15 phút; OTP khôi phục mật khẩu gửi qua email có thời hạn 10 phút.
- [x] **Ma trận phân quyền nghiêm ngặt**:
  - **Quản trị viên (`admin`)**: Toàn quyền hệ thống, quản lý cơ cấu trường, audit log, phê duyệt cấp trường.
  - **Trưởng khoa/Viện trưởng (`truongkhoa`)**: Quản lý cán bộ, phân công lịch dạy và duyệt đơn từ thuộc phạm vi Khoa/Viện.
  - **Giảng viên (`giangvien`) & Nhân viên (`nhanvien`)**: Tra cứu lịch cá nhân, điểm danh, nộp đơn nghỉ/dạy bù, xem thống kê công.

### 🏢 2. Quản lý Cơ cấu Tổ chức & Nhân sự
- [x] **Cây phòng ban đa cấp (`/api/departments/tree`)**: Mô hình hóa mối quan hệ phân cấp giữa Ban Giám hiệu ➔ Khoa/Viện ➔ Bộ môn trực thuộc.
- [x] **Hồ sơ nhân sự**: Lưu trữ mã cán bộ, học hàm, học vị, chức vụ, bộ môn công tác và hạn mức nghỉ phép hàng năm (`annualLeaveQuota`).

### ⏰ 3. Quản lý Ca làm việc & Lịch giảng dạy
- [x] **Cấu hình ca linh hoạt**: Ca Sáng, Chiều, Tối, Hành chính; thiết lập ngưỡng đi trễ (Grace period) và về sớm tính bằng phút.
- [x] **Thời khóa biểu thông minh**: Quản lý lịch dạy theo học kỳ, phòng học; tự động phát hiện và ngăn chặn trùng lịch của giảng viên hoặc trùng phòng học.

### 📸 4. Chấm công Đa phương thức & Kiosk AI
- [x] **Smart Kiosk FaceID**: Nhận diện khuôn mặt thời gian thực qua Camera Kiosk với cơ chế Wake/Sleep thông minh (tự động ngủ khi không có người để tiết kiệm CPU/RAM).
- [x] **Chấm công GPS (Geofencing)**: Xác thực toạ độ thiết bị của giảng viên với bán kính khuôn viên trường đại học (bản đồ trực quan).
- [x] **Tự động hóa điểm danh (Cron Engine)**: Cron job tự động quét các ca học kết thúc trong ngày; nếu giảng viên không check-in sẽ tự động ghi nhận trạng thái `ABSENT` (Vắng mặt).
- [x] **Admin Manual Override**: Hỗ trợ cán bộ quản trị điều chỉnh điểm danh trong các trường hợp có sự cố khách quan (kèm ghi chú giải trình).

### 📝 5. Quy trình Đơn nghỉ phép & Đăng ký Dạy bù
- [x] **Tính toán hạn mức phép bằng MongoDB Aggregation**: Tự động tổng hợp số ngày phép đã sử dụng và đang chờ duyệt ngay trên Database, loại bỏ sai số do múi giờ hoặc ca dạy.
- [x] **Chặn nộp trùng lặp**: Ngăn chặn tình trạng nộp đơn chồng chéo ngày hoặc nộp lùi về các ngày trong quá khứ.
- [x] **Liên thông điểm danh tự động**: Ngay khi Trưởng khoa duyệt đơn `nghi_phep`, hệ thống tự động sinh bản ghi chấm công `EXCUSED_ABSENCE` (Nghỉ có phép) thông qua `bulkWrite` tối ưu $O(1)$.

### 🤖 6. Trợ lý ảo AI & Phân tích Dữ liệu (AI Assistant)
- [x] **Xử lý ngôn ngữ tự nhiên tiếng Việt**: Hiểu các câu hỏi tự nhiên về lịch dạy ("Tuần này tôi có mấy tiết?", "Khoa CNTT hôm nay có bao nhiêu thầy cô vắng?").
- [x] **Kiến trúc Augmented Analytics**: AI không bị ảo giác số liệu (Hallucination) do dữ liệu được tính toán chính xác 100% từ MongoDB Aggregation trước khi chuyển cho LLM (Gemini) định dạng câu trả lời sư phạm.
- [x] **Phân quyền trong câu trả lời**: Giảng viên chỉ hỏi được thông tin cá nhân; Trưởng khoa chỉ hỏi được số liệu trong Khoa.

### 📊 7. Thống kê, Báo cáo & Nhật ký Kiểm toán
- [x] **Dashboard phân tích trực quan**: Biểu đồ tỷ lệ chuyên cần, biểu đồ phân bổ nhân sự theo phòng ban, danh sách đi muộn/về sớm.
- [x] **Xuất báo cáo chuyên nghiệp**: Xuất dữ liệu chấm công tháng ra file Excel (`.xlsx`) chuẩn mẫu hành chính; in phiếu xác nhận công giảng dạy trực tiếp từ trình duyệt.
- [x] **Audit Log toàn diện**: Ghi vết mọi thao tác nhạy cảm (Duyệt đơn, sửa giờ công, phân quyền, đổi mật khẩu) kèm IP, thời gian và người thực hiện.

---

## 📂 4. Cấu Trúc Dự Án

```text
TTDN-XDHTQLCCCTDH/
├── src/                               # BACKEND SOURCE CODE (Node.js/Express)
│   ├── app.js                         # Khởi tạo Express app, cấu hình middleware
│   ├── server.js                      # Điểm khởi động server & kết nối Database
│   ├── config/                        # Cấu hình Database, Mailer, Swagger
│   ├── controllers/                   # Xử lý logic nghiệp vụ các endpoint
│   │   ├── attendance.controller.js   # Điểm danh, FaceID, Kiosk logic
│   │   ├── leaveRequest.controller.js # Xử lý đơn phép, quota, bulkWrite
│   │   └── ai.controller.js           # Trợ lý AI chat
│   ├── middlewares/                   # JWT Auth, Role RBAC, Rate Limiter
│   ├── models/                        # Mongoose Schemas (User, Attendance, Schedule...)
│   ├── routes/                        # Định nghĩa API routes theo phân hệ
│   ├── services/                      # Analytics Engine, Email Service, AI LLM Service
│   └── utils/                         # Helper functions, Seeder, Response Handlers
│
├── frontend/                          # FRONTEND SOURCE CODE (React/TypeScript/Vite)
│   ├── src/
│   │   ├── api/                       # Axios client & API request services
│   │   ├── components/                # Reusable UI components
│   │   │   ├── ui/                    # 8 UI primitives (Button, Modal, Table, Input...)
│   │   │   ├── common/                # Shared layout items, Avatar, Map
│   │   │   └── camera/                # Camera capture & Canvas preview
│   │   ├── contexts/                  # AuthContext, ThemeContext
│   │   ├── hooks/                     # Custom hooks & Kiosk AI logic
│   │   │   └── kiosk/                 # FaceID scan loop, camera lifecycle, motion worker
│   │   ├── pages/                     # Các trang ứng dụng theo phân hệ
│   │   │   ├── admin/                 # Quản lý nhân sự, phòng ban, ca làm, audit
│   │   │   ├── attendance/            # Chấm công cá nhân & lịch sử
│   │   │   ├── face/                  # Đăng ký khuôn mặt & Kiosk điểm danh
│   │   │   ├── leave/                 # Nộp đơn & Phê duyệt đơn
│   │   │   └── dashboard/             # Bảng điều khiển thống kê tổng quan
│   │   └── routes/                    # Cấu hình AppRoutes với ProtectedRoute
│   └── public/                        # Static assets, models AI
│
├── docs/                              # TÀI LIỆU CHUYÊN SÂU DỰ ÁN
│   ├── AI_ASSISTANT_SPEC.md           # Đặc tả phân hệ Trợ lý ảo AI & Augmented Analytics
│   ├── API_REFERENCE.md               # Danh mục chi tiết các Endpoint API & Data Models
│   ├── FACE_ID_ACCURACY_REPORT.md     # Báo cáo đánh giá độ chính xác Kiosk FaceID
│   └── DEMO_BACKUP_PLAN.md            # Kịch bản khao sát & demo dự phòng
├── uploads/                           # Lưu trữ file đính kèm đơn phép & ảnh điểm danh
└── requests.http                      # File HTTP Client kiểm thử nhanh API
```

---

## 🚀 5. Hướng Dẫn Cài Đặt & Khởi Chạy (Step-by-step)

### 📋 Yêu cầu hệ thống
- **Node.js**: Phiên bản `v20.0.0` trở lên.
- **MongoDB**: Bản cài đặt Local (cổng `27017`) hoặc đường dẫn kết nối [MongoDB Atlas](https://www.mongodb.com/atlas).
- **Trình duyệt**: Google Chrome hoặc Microsoft Edge (hỗ trợ Camera API & WebRTC).

---

### Bước 1: Clone mã nguồn dự án
```bash
git clone https://github.com/Vu-Tien-Duc/TTDN-XDHTQLCCCTDH.git
cd TTDN-XDHTQLCCCTDH
```

---

### Bước 2: Cài đặt các gói phụ thuộc (Dependencies)
Cài đặt đồng thời cho cả Backend và Frontend:
```bash
# Cài đặt thư viện cho Backend
npm install

# Cài đặt thư viện cho Frontend
npm install --prefix frontend
```

---

### Bước 3: Cấu hình biến môi trường (`.env`)
Tạo file `.env` tại thư mục gốc của dự án (`TTDN-XDHTQLCCCTDH/.env`) với nội dung mẫu:

```env
# Cấu hình Máy chủ Backend
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Cấu hình Cơ sở dữ liệu MongoDB
MONGODB_URI=mongodb://localhost:27017/university_attendance_db

# Bảo mật JWT
JWT_SECRET=your_super_secret_jwt_access_key_university_2026
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key_university_2026
REFRESH_TOKEN_EXPIRES_IN=7d

# Dịch vụ gửi Email (Google App Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_digit_google_app_password

# Tích hợp Trợ lý Trí tuệ nhân tạo (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Lưu ý về Email & AI:**
> - Nếu chưa có tài khoản SMTP, hệ thống sẽ tự động bật chế độ **Development Fallback** và in trực tiếp mã OTP ra Terminal điều khiển.
> - Nếu chưa cấu hình `GEMINI_API_KEY`, trợ lý AI sẽ tự động kích hoạt **Rule-based Analytics Fallback** để trả về số liệu chính xác mà không báo lỗi.

---

### Bước 4: Khởi tạo dữ liệu mẫu (Database Seeding)
Hệ thống tích hợp sẵn bộ seeder chuẩn hóa, bao gồm: 10 phòng ban/bộ môn, các tài khoản mẫu cho 4 vai trò, cấu hình 3 ca học, lịch giảng dạy mẫu và bảng điểm danh:

```bash
npm run seed
```

---

### Bước 5: Khởi chạy môi trường phát triển (Development)

Mở 2 cửa sổ dòng lệnh (Terminal) để chạy song song Backend và Frontend:

**Terminal 1 — Khởi động Backend API:**
```bash
npm run dev
# Server sẽ khởi chạy tại: http://localhost:5000
# Tài liệu Swagger API tại: http://localhost:5000/api-docs
```

**Terminal 2 — Khởi động Frontend Client:**
```bash
npm run dev --prefix frontend
# Giao diện Web Client sẽ mở tại: http://localhost:5173
```

---

### Bước 6: Đóng gói và Khởi chạy Production
Để kiểm tra phiên bản xuất xưởng (Production Bundle):
```bash
# 1. Typecheck và Build toàn bộ Frontend thành file tĩnh
npm run build

# 2. Chạy Backend phục vụ luôn cả API và Static Web App
npm start
```
Truy cập toàn diện hệ thống duy nhất tại địa chỉ: `http://localhost:5000`.

---

## 👥 6. Danh Sách Tài Khoản Demo Khảo Sát

Hệ thống cung cấp sẵn danh sách tài khoản theo từng vai trò để Hội đồng đánh giá và giảng viên kiểm thử (Mật khẩu chung cho tất cả tài khoản là: **`password123`**):

| Vai trò (Role) | Họ và tên mẫu | Email đăng nhập | Quyền hạn tiêu biểu |
| :--- | :--- | :--- | :--- |
| **Quản trị viên** | Quản Trị Hệ Thống | `daihocdtd@gmail.com` | Quản lý phòng ban, phân quyền, cấu hình ca, xem audit logs toàn trường |
| **Quản trị viên** | Ban Giám Hiệu / Nhân sự | `admin.hr@university.edu.vn` | Duyệt đơn nghỉ phép cấp trường, xem toàn bộ báo cáo chuyên cần |
| **Trưởng khoa** | PGS. TS. Trần Trọng Khoa | `truongkhoa.cntt@university.edu.vn` | Duyệt đơn nghỉ, xem thời khóa biểu, thống kê giảng viên Khoa CNTT |
| **Trưởng khoa** | TS. Hoàng Kinh Tế | `truongkhoa.kinhte@university.edu.vn` | Quản lý nhân sự và lịch giảng dạy thuộc Khoa Kinh tế |
| **Giảng viên** | ThS. Nguyễn Văn Cường | `giangvien.cuong@university.edu.vn` | Xem lịch dạy cá nhân, check-in Kiosk/GPS, nộp đơn nghỉ phép năm |
| **Giảng viên** | ThS. Lê Thị Bích | `giangvien.bich@university.edu.vn` | Điểm danh, tra cứu số dư phép năm, chat với trợ lý ảo AI |
| **Nhân viên** | Nguyễn Thị Hà | `nhanvien.ha@university.edu.vn` | Chấm công giờ hành chính, theo dõi đơn từ cá nhân |

> 💡 **Mẹo trải nghiệm nhanh:** Tại góc trên giao diện Web Client có tích hợp thanh **Quick Role Switcher**, cho phép bấm 1-click để chuyển đổi tức thì giữa các tài khoản demo mà không cần gõ lại email/mật khẩu!

---

## 📊 7. Danh Mục API Chính (Swagger Endpoint Reference)

| Nhóm chức năng | Endpoint | Phương thức | Thẩm quyền tối thiểu | Mô tả ngắn |
| :--- | :--- | :---: | :---: | :--- |
| **Xác thực** | `/api/auth/login` | `POST` | Public | Đăng nhập tài khoản & nhận JWT |
| | `/api/auth/refresh` | `POST` | Public | Gia hạn access token mới |
| | `/api/auth/logout` | `POST` | Bearer | Đăng xuất & thu hồi token |
| | `/api/auth/forgot-password` | `POST` | Public | Gửi mã OTP khôi phục qua email |
| **Nhân sự** | `/api/users` | `GET` | Trưởng khoa | Danh sách cán bộ theo phân cấp |
| | `/api/users` | `POST` | Admin | Tạo mới tài khoản cán bộ |
| **Tổ chức** | `/api/departments/tree` | `GET` | Giảng viên | Cấu trúc cây đơn vị/phòng ban |
| **Lịch dạy** | `/api/schedules` | `GET` | Giảng viên | Xem lịch dạy theo khoảng ngày |
| | `/api/schedules` | `POST` | Trưởng khoa | Phân công lịch dạy & kiểm tra trùng |
| **Điểm danh** | `/api/attendance/check-in` | `POST` | Giảng viên | Check-in qua GPS/FaceID |
| | `/api/attendance/kiosk-detect` | `POST` | Giảng viên | API Kiosk AI nhận diện khuôn mặt |
| | `/api/attendance/history` | `GET` | Giảng viên | Xem lịch sử chấm công cá nhân |
| **Nghỉ phép** | `/api/leave-requests` | `POST` | Giảng viên | Nộp đơn xin nghỉ phép/dạy bù |
| | `/api/leave-requests/balance`| `GET` | Giảng viên | Xem số dư phép năm tính bằng Aggregation |
| | `/api/leave-requests/:id/approve` | `PUT`| Trưởng khoa | Phê duyệt đơn & tự động gán điểm danh |
| **Báo cáo** | `/api/reports/monthly` | `GET` | Trưởng khoa | Báo cáo chuyên cần tổng hợp theo tháng |
| **Trợ lý AI** | `/api/ai/chat` | `POST` | Giảng viên | Chat hỏi đáp dữ liệu ngôn ngữ tự nhiên |
| **Kiểm toán** | `/api/audit-logs` | `GET` | Admin | Nhật ký truy vết các thao tác nhạy cảm |

---

## 🛡️ 8. Kiểm Thử & Tiêu Chuẩn Chất Lượng Mã Nguồn

Dự án áp dụng quy trình kiểm thử và rà soát nghiêm ngặt trước khi xuất xưởng:
- **Kiểm tra kiểu dữ liệu TypeScript**: `npm run build --prefix frontend` đảm bảo 100% strict type, không có lỗi runtime.
- **Rà soát cú pháp tĩnh (Linter)**: `npm run lint --prefix frontend` kiểm soát chất lượng code UI.
- **Bảo vệ toàn vẹn Backend**: Đã audit toàn diện an ninh mạng (chống SQL/NoSQL Injection, Race Condition với Atomic Update, phân quyền Scope Dean/Admin).
- **Tối ưu hóa Database**: Triệt tiêu lỗi N+1 Query bằng `AttendanceLog.bulkWrite` và đẩy toán tử tính dồn ngày xuống MongoDB Aggregation Engine.

---

## 📜 9. Giấy Phép & Tác Quyền

Dự án được xây dựng và hoàn thiện phục vụ cho mục đích nghiên cứu và đồ án tốt nghiệp đại học chuyên ngành Công Nghệ Thông Tin.

* **Tác giả:** Vũ Tiến Đức & Nhóm phát triển đề tài
* **Mọi đóng góp & phản hồi xin gửi về:** `daihocdtd@gmail.com`
