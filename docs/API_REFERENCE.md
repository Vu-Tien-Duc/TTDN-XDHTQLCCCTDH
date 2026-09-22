# 📡 TÀI LIỆU API CHI TIẾT (API REFERENCE)

> **Base URL:** `http://localhost:5000/api` (Môi trường Development) hoặc `/api` (Production)  
> **Swagger UI Trực Quan:** `http://localhost:5000/api-docs`  
> **Chuẩn Định Dạng Phản Hồi:**  
> `{ "success": boolean, "message": string, "data": any }`

---

## 🔑 Xác Thực & Phân Quyền (Authentication)

Tất cả các API nghiệp vụ (ngoại trừ các endpoint Public như Đăng nhập, Quên mật khẩu, Health Check) đều yêu cầu Header:
```http
Authorization: Bearer <access_token>
```

---

## 1. Phân Hệ Xác Thực — `/api/auth`

### `POST /api/auth/login` — Đăng nhập hệ thống
- **Giới hạn (Rate Limit):** 5 lần đăng nhập sai / 15 phút.
- **Request Body:**
```json
{
  "email": "daihocdtd@gmail.com",
  "password": "password123"
}
```
- **Response 200 (Thành công):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công.",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "_id": "60d0fe4f5311236168a109ca",
      "fullName": "Quản Trị Hệ Thống",
      "email": "daihocdtd@gmail.com",
      "role": "admin"
    }
  }
}
```

### `POST /api/auth/refresh` — Làm mới Access Token (Silent Refresh)
- **Cơ chế:** Gửi kèm HTTP-Only Cookie chứa `refreshToken` hoặc Body `{ "refreshToken": "..." }`.
- **Response 200:** Cấp `accessToken` mới (thời hạn 15 phút).

### `POST /api/auth/logout` — Đăng xuất & Thu hồi phiên
- **Cơ chế:** Đưa `accessToken` hiện tại vào Blacklist và xóa bản ghi `refreshToken` trong Database.

### `POST /api/auth/forgot-password` — Yêu cầu cấp OTP khôi phục mật khẩu
- **Request Body:** `{ "email": "giangvien.cuong@university.edu.vn" }`
- **Cơ chế:** Gửi OTP 6 số qua email (hiệu lực 10 phút). Nếu chưa cấu hình SMTP, mã OTP sẽ in ra Terminal.

### `POST /api/auth/reset-password` — Đặt lại mật khẩu bằng OTP
- **Request Body:**
```json
{
  "email": "giangvien.cuong@university.edu.vn",
  "otp": "123456",
  "newPassword": "matkhaumoi123"
}
```

### `GET /api/auth/me` — Lấy thông tin tài khoản đang đăng nhập
- **Thẩm quyền:** Mọi vai trò đã đăng nhập (Bearer Token).

---

## 2. Quản Lý Cán Bộ & Người Dùng — `/api/users`

> **Thẩm quyền:** `admin` (toàn quyền), `truongkhoa` (chỉ xem/sửa cán bộ thuộc khoa mình quản lý).

### `GET /api/users` — Tra cứu danh sách cán bộ
- **Query Params:** `?role=giangvien&departmentId=<id>&search=Nguyễn&page=1&limit=20`

### `POST /api/users` — Tạo mới tài khoản cán bộ (Admin only)
- **Request Body:**
```json
{
  "fullName": "ThS. Nguyễn Văn B",
  "email": "giangvien.b@university.edu.vn",
  "password": "password123",
  "role": "giangvien",
  "departmentId": "65b...",
  "annualLeaveQuota": 12
}
```

### `GET /api/users/:id` — Chi tiết hồ sơ cán bộ

### `PUT /api/users/:id` — Cập nhật thông tin cán bộ
- **Trưởng khoa:** Chỉ được chỉnh sửa `fullName`, `annualLeaveQuota`.
- **Admin:** Chỉnh sửa toàn bộ thông tin (họ tên, khoa/phòng, trạng thái kích hoạt, hạn mức phép).

### `DELETE /api/users/:id` — Khóa tài khoản (Soft Delete — Admin only)
- Chuyển `isActive = false` để vô hiệu hóa đăng nhập, bảo toàn toàn vẹn dữ liệu lịch sử.

---

## 3. Quản Lý Cơ Cấu Tổ Chức — `/api/departments`

### `GET /api/departments` — Danh sách phẳng các phòng ban/khoa
### `GET /api/departments/tree` — Cấu trúc cây tổ chức phân cấp
- **Response:** Trả về danh sách đơn vị lồng nhau theo cấp: Ban Giám Hiệu ➔ Khoa/Viện ➔ Bộ môn.

### `GET /api/departments/:id` — Chi tiết đơn vị
### `POST /api/departments` — Tạo mới đơn vị (Admin only)
- **Request Body:**
```json
{
  "name": "Khoa Công Nghệ Thông Tin",
  "type": "khoa",
  "parentId": "<ObjectId Ban Giám Hiệu>",
  "location": { "lat": 21.0285, "lng": 105.8542 }
}
```
- **Giá trị `type` hợp lệ:** `truong` | `khoa` | `bomon` | `phongban`.

### `PUT /api/departments/:id` — Cập nhật đơn vị
### `DELETE /api/departments/:id` — Xóa đơn vị (Admin only)

---

## 4. Quản Lý Ca Làm Việc — `/api/shifts` (hoặc `/api/shift-configs`)

### `GET /api/shifts` — Danh sách tất cả ca học / ca làm việc
### `GET /api/shifts/:id` — Chi tiết một ca
### `POST /api/shifts` — Cấu hình ca mới (Admin only)
- **Request Body:**
```json
{
  "name": "Ca Sáng (Tiết 1-4)",
  "startTime": "07:00",
  "endTime": "11:30",
  "lateThresholdMinutes": 15,
  "earlyExitThresholdMinutes": 15,
  "isActive": true
}
```
### `PUT /api/shifts/:id` — Chỉnh sửa ca (Admin only)
### `DELETE /api/shifts/:id` — Xóa ca (Admin only)

---

## 5. Phân Công Lịch Giảng Dạy — `/api/schedules`

### `GET /api/schedules` — Tra cứu thời khóa biểu
- **Query Params:** `?userId=<id>&departmentId=<id>&weekday=1&shiftId=<id>`
### `GET /api/schedules/today` — Lịch giảng dạy trong ngày hôm nay
- Tự động lọc theo thứ trong tuần hiện tại và khoảng thời gian học kỳ.

### `POST /api/schedules` — Phân công lịch giảng dạy (Admin, Trưởng Khoa)
- **Request Body:**
```json
{
  "userId": "<ObjectId Giảng viên>",
  "shiftId": "<ObjectId Ca học>",
  "weekday": 1,
  "roomId": "A2-301",
  "isRecurring": true,
  "startDate": "2026-01-15",
  "endDate": "2026-06-30",
  "subjectName": "Lập trình Web nâng cao",
  "subjectCode": "CS302"
}
```
- **Quy tắc:** Tự động phát hiện và trả về HTTP `409 Conflict` nếu giảng viên bị trùng ca dạy hoặc phòng học đã có lớp khác.

### `PUT /api/schedules/:id` — Cập nhật lịch dạy
### `DELETE /api/schedules/:id` — Xóa lịch dạy

---

## 6. Điểm Danh & Chấm Công — `/api/attendance`

### `POST /api/attendance/check-in` — Điểm danh vào ca
- **Request Body (Tùy chọn):**
```json
{
  "shiftId": "<ObjectId Ca học>",
  "method": "face",
  "deviceId": "KIOSK_A2",
  "confidenceScore": 0.94,
  "location": { "lat": 21.0285, "lng": 105.8542 }
}
```
- **Phương thức (`method`):** `manual` | `face` | `qr` | `gps` | `admin_override`.
- **Trạng thái ghi nhận:** `ON_TIME` (Đúng giờ) hoặc `LATE` (Trễ giờ dựa trên cấu hình ca).

### `POST /api/attendance/check-out` — Điểm danh ra ca
- **Request Body:** `{ "shiftId": "<ObjectId Ca học>" }`
- **Trạng thái ghi nhận:** Ghi nhận giờ ra, chuyển cờ `EARLY_LEAVE` nếu về sớm quá ngưỡng.

### `GET /api/attendance/history` — Lịch sử chấm công
- **Query Params:** `?userId=<id>&from=2026-09-01&to=2026-09-30&status=ON_TIME&page=1&limit=20`

### `PUT /api/attendance/:id` — Quản trị viên điều chỉnh giờ công (Override)
- **Request Body:**
```json
{
  "status": "EXCUSED_ABSENCE",
  "note": "Giảng viên đi công tác theo công văn số 12/DHQG"
}
```

### `POST /api/attendance/trigger-absent-check` — Kích hoạt quét vắng mặt (Cron Test)
- Tự động tạo bản ghi `ABSENT` cho các ca dạy đã qua thời gian điểm danh mà chưa có check-in.

---

## 7. Đơn Xin Nghỉ Phép & Dạy Bù — `/api/leave-requests`

### `POST /api/leave-requests` — Tạo đơn xin nghỉ / dạy bù / đổi ca
- **Content-Type:** `multipart/form-data` (kèm file) hoặc `application/json`.
- **Request Body:**
```json
{
  "type": "nghi_phep",
  "reason": "Tham gia hội thảo khoa học quốc tế",
  "startDate": "2026-09-25",
  "endDate": "2026-09-26",
  "attachmentUrl": "/uploads/giay-moi.pdf"
}
```
- **Loại đơn (`type`):** `nghi_phep` | `day_bu` | `doi_ca`.

### `GET /api/leave-requests` — Danh sách đơn từ
- Giảng viên xem đơn của mình; Trưởng khoa xem đơn trong khoa; Admin xem toàn trường.

### `GET /api/leave-requests/balance` — Tra cứu số dư phép năm
- **Cơ chế:** Tính toán số ngày đã dùng (`daysUsed`) và đang chờ duyệt (`pendingDays`) bằng **MongoDB Aggregation Pipeline**.

### `PUT /api/leave-requests/:id/approve` — Phê duyệt đơn (Admin, Trưởng Khoa)
- **Cơ chế:** Cập nhật trạng thái `APPROVED` và đồng thời tự động cập nhật/tạo bản ghi điểm danh `EXCUSED_ABSENCE` qua `bulkWrite`.

### `PUT /api/leave-requests/:id/reject` — Từ chối đơn (Admin, Trưởng Khoa)
- **Request Body:** `{ "rejectionReason": "Lịch học bù chưa bố trí được phòng trống" }`

---

## 8. Báo Cáo & Thống Kê — `/api/reports`

### `GET /api/reports/attendance` — Báo cáo tổng hợp số liệu chấm công
- **Query Params:** `?userId=<id>&departmentId=<id>&from=2026-09-01&to=2026-09-30`
- **Response:**
```json
{
  "totalRecords": 180,
  "onTimeCount": 160,
  "lateCount": 12,
  "earlyLeaveCount": 3,
  "absentCount": 3,
  "excusedAbsenceCount": 2,
  "approvedLeaveDays": 2
}
```

### `GET /api/reports/monthly` — Báo cáo chi tiết theo tháng phục vụ tính lương
- **Query Params:** `?month=9&year=2026&departmentId=<id>`

---

## 9. Trợ Lý Ảo Thông Minh — `/api/ai`

### `POST /api/ai/chat` — Hỏi đáp ngôn ngữ tự nhiên
- **Request Body:**
```json
{
  "question": "Tuần này tôi có những buổi dạy nào?"
}
```
- **Response 200:**
```json
{
  "success": true,
  "message": "Phản hồi từ AI thành công.",
  "data": {
    "reply": "Chào Thầy/Cô! Lịch giảng dạy của Thầy/Cô trong tuần này gồm có 3 buổi...",
    "source": "gemini-1.5-flash",
    "metadata": {
      "teachingSessionsCount": 3,
      "dateRange": { "from": "2026-09-21", "to": "2026-09-27" }
    }
  }
}
```

---

## 10. Nhật Ký Kiểm Toán (Audit Logs) — `/api/audit-logs`

### `GET /api/audit-logs` — Danh sách truy vết hành động nhạy cảm (Admin only)
- **Query Params:** `?actor=<userId>&action=APPROVE_LEAVE&startDate=2026-09-01&endDate=2026-09-30`

---

## 11. Quản Lý Tệp Tin — `/api/upload`

### `POST /api/upload` — Tải tệp minh chứng
- **Content-Type:** `multipart/form-data` (field `file`).
- **Định dạng cho phép:** JPG, PNG, WEBP, PDF, DOC, DOCX (tối đa 10MB).
- **Response:** `{ "data": { "url": "/uploads/filename.pdf" } }`

---

## 12. Kiểm Tra Trạng Thái Hệ Thống — `/api/health`

### `GET /api/health` — Health check endpoint (Public)
- **Response:**
```json
{
  "status": "OK",
  "message": "Hệ thống đang hoạt động bình thường.",
  "collectionsCount": 9,
  "timestamp": "2026-09-22T14:00:00.000Z"
}
```

---

## 📋 Bảng Mã Trạng Thái Điểm Danh (`status`)

| Mã trạng thái | Diễn giải nghiệp vụ |
| :--- | :--- |
| `ON_TIME` | Đúng giờ (Check-in trước hoặc đúng ngưỡng cho phép trễ của ca) |
| `LATE` | Đi muộn (Check-in sau ngưỡng cho phép trễ của ca) |
| `EARLY_LEAVE` | Về sớm (Check-out trước ngưỡng cho phép ra sớm của ca) |
| `ABSENT` | Vắng mặt không phép (Tự động sinh bởi Cron Job khi hết ca mà không có check-in) |
| `EXCUSED_ABSENCE` | Vắng mặt có phép (Tự động liên thông khi đơn xin nghỉ phép được Trưởng khoa phê duyệt) |
