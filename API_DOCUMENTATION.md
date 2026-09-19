# 📡 Tài Liệu API — Hệ Thống Quản Lý Chấm Công Trường Đại Học

> **Base URL:** `http://localhost:5000/api` (development) hoặc `/api` (production)
> **Swagger UI:** `http://localhost:5000/api-docs`
> **Format Response:** `{ success: boolean, message: string, data: any }`

---

## 🔑 Xác Thực (Authentication)

Tất cả API (trừ Auth) yêu cầu Header:
```
Authorization: Bearer <access_token>
```

---

## 1. Auth — `/api/auth`

### POST `/auth/login` — Đăng nhập
- **Rate Limit:** 5 lần / 15 phút
- **Body:**
```json
{ "email": "daihocdtd@gmail.com", "password": "password123" }
```
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": { "_id": "...", "fullName": "...", "email": "...", "role": "admin" }
  }
}
```

### POST `/auth/register` — Đăng ký tài khoản
- **Body:**
```json
{
  "fullName": "Nguyễn Văn A",
  "email": "nguyenvana@university.edu.vn",
  "password": "matkhau123",
  "role": "giangvien",
  "departmentId": "<ObjectId>"
}
```
- **Response 201:** Gửi OTP 6 số về email, hiệu lực 10 phút.

### POST `/auth/verify-otp` — Xác minh OTP
- **Body:**
```json
{ "email": "nguyenvana@university.edu.vn", "otp": "123456" }
```

### POST `/auth/forgot-password` — Quên mật khẩu
- **Body:** `{ "email": "nguyenvana@university.edu.vn" }`

### POST `/auth/reset-password` — Đặt lại mật khẩu
- **Body:**
```json
{ "email": "nguyenvana@university.edu.vn", "otp": "123456", "newPassword": "matkhaumoi" }
```

### POST `/auth/refresh` — Làm mới Access Token
- **Cookie:** Gửi kèm httpOnly cookie chứa refreshToken

### POST `/auth/logout` — Đăng xuất
- **Header:** `Authorization: Bearer <token>`

### GET `/auth/me` — Lấy thông tin tài khoản đang đăng nhập
- **Auth:** Token bắt buộc

---

## 2. Users — `/api/users`

> **Quyền truy cập:** Admin (toàn quyền), Trưởng Khoa (chỉ xem/sửa user trong khoa mình)

### GET `/users` — Danh sách người dùng
- **Query params:** `?role=giangvien&departmentId=<id>&search=Trần`
- **Trưởng Khoa:** Tự động lọc theo `departmentId` của mình

### POST `/users` — Thêm người dùng (Admin only)
- **Body:**
```json
{
  "fullName": "ThS. Nguyễn Văn B",
  "email": "giangvien.b@university.edu.vn",
  "password": "password123",
  "role": "giangvien",
  "departmentId": "<ObjectId>",
  "annualLeaveQuota": 12
}
```

### GET `/users/:id` — Chi tiết người dùng

### PUT `/users/:id` — Cập nhật người dùng
- **Trưởng Khoa** chỉ được sửa: `fullName`, `annualLeaveQuota`
- **Admin** sửa được tất cả: `fullName`, `role`, `departmentId`, `isActive`, `annualLeaveQuota`

### DELETE `/users/:id` — Khóa tài khoản (Soft Delete — Admin only)
- Đặt `isActive = false`, không xóa dữ liệu

---

## 3. Departments — `/api/departments`

### GET `/departments` — Danh sách phẳng

### GET `/departments/tree` — Cây cấu trúc phân cấp
- **Response:** Trả về mảng departments với `children` lồng nhau (Ban Giám Hiệu → Khoa → Bộ Môn)

### GET `/departments/:id` — Chi tiết đơn vị

### POST `/departments` — Tạo đơn vị (Admin only)
- **Body:**
```json
{
  "name": "Khoa Ngoại ngữ",
  "type": "khoa",
  "parentId": "<ObjectId của Ban Giám Hiệu>",
  "location": { "lat": 21.028, "lng": 105.854 }
}
```
- **type:** `truong` | `khoa` | `bomon` | `phongban`

### PUT `/departments/:id` — Cập nhật đơn vị (Admin, Trưởng Khoa)

### DELETE `/departments/:id` — Xóa đơn vị (Admin only)

---

## 4. Shifts (Ca Làm Việc) — `/api/shifts`

> Alias: `/api/shift-configs` cũng hoạt động

### GET `/shifts` — Danh sách ca làm việc

### GET `/shifts/:id` — Chi tiết ca

### POST `/shifts` — Tạo ca mới (Admin only)
- **Body:**
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

### PUT `/shifts/:id` — Cập nhật ca (Admin only)

### DELETE `/shifts/:id` — Xóa ca (Admin only)

---

## 5. Schedules (Lịch Giảng Dạy) — `/api/schedules`

### GET `/schedules` — Danh sách lịch giảng dạy
- **Query:** `?userId=<id>&departmentId=<id>&weekday=1&shiftId=<id>`
- **Populate:** `userId`, `shiftId`, `departmentId`

### GET `/schedules/today` — Lịch dạy hôm nay
- Tự động lọc theo weekday hiện tại và khoảng hiệu lực (startDate ≤ today ≤ endDate)

### GET `/schedules/:id` — Chi tiết 1 lịch

### POST `/schedules` — Tạo lịch mới (Admin, Trưởng Khoa)
- **Body:**
```json
{
  "userId": "<ObjectId giảng viên>",
  "shiftId": "<ObjectId ca>",
  "weekday": 1,
  "roomId": "Phòng A2-301",
  "isRecurring": true,
  "startDate": "2026-01-15",
  "endDate": "2026-12-31",
  "subjectName": "Lập trình Web",
  "subjectCode": "CS201"
}
```
- **weekday:** 0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy
- **Conflict detection:** Nếu trùng lịch → trả về **409 Conflict**

### PUT `/schedules/:id` — Cập nhật lịch

### DELETE `/schedules/:id` — Xóa lịch

---

## 6. Attendance (Chấm Công) — `/api/attendance`

### POST `/attendance/check-in` — Điểm danh vào
- **Body (tùy chọn):**
```json
{
  "shiftId": "<ObjectId ca — nếu muốn chỉ định ca thủ công>",
  "method": "manual",
  "deviceId": "KIOSK_GATE_A2",
  "location": { "lat": 21.028, "lng": 105.854 }
}
```
- **Nếu không truyền `shiftId`:** Hệ thống tự động tìm lịch dạy hôm nay trong khung giờ hiện tại (± 30 phút)
- **method:** `manual` | `face` | `qr` | `gps` | `fingerprint`
- **Trả về:** Trạng thái `ON_TIME` hoặc `LATE` (dựa trên `lateThresholdMinutes` của ca)
- **Lỗi 409:** Đã check-in ca này hôm nay rồi

### POST `/attendance/check-out` — Điểm danh ra
- **Body:**
```json
{ "shiftId": "<ObjectId ca>" }
```
- **Trả về:** Trạng thái check-out + `EARLY_LEAVE` nếu ra sớm quá ngưỡng

### GET `/attendance/history` — Lịch sử chấm công
- **Query:** `?userId=<id>&from=2026-09-01&to=2026-09-30&status=LATE&page=1&limit=20`
- **Phân quyền:** Giảng viên/Nhân viên chỉ xem của mình, Trưởng Khoa xem trong khoa, Admin xem toàn trường

### GET `/attendance/:id` — Chi tiết 1 bản ghi

### PUT `/attendance/:id` — Admin chỉnh sửa chấm công
- **Body:**
```json
{
  "status": "EXCUSED_ABSENCE",
  "note": "Đã có đơn nghỉ phép được duyệt"
}
```

### POST `/attendance/trigger-absent-check` — Chạy kiểm tra vắng mặt thủ công (Admin)
- Kích hoạt cron job tạo record ABSENT cho những ca chưa check-in

---

## 7. Leave Requests (Đơn Nghỉ Phép) — `/api/leave-requests`

### POST `/leave-requests` — Tạo đơn xin nghỉ
- **Content-Type:** `multipart/form-data` (nếu đính kèm file) hoặc `application/json`
- **Body:**
```json
{
  "type": "nghi_phep",
  "reason": "Lý do cá nhân",
  "startDate": "2026-09-25",
  "endDate": "2026-09-26",
  "attachmentUrl": "(tùy chọn)"
}
```
- **type:** `nghi_phep` | `day_bu` | `doi_ca`
- **File upload:** Form field `file` (JPG, PNG, WEBP, PDF, DOC, DOCX — tối đa 10MB)

### GET `/leave-requests` — Danh sách đơn
- **Giảng viên/Nhân viên:** Chỉ thấy đơn của mình
- **Trưởng Khoa:** Thấy đơn của nhân sự trong khoa
- **Admin:** Thấy tất cả

### GET `/leave-requests/balance` — Kiểm tra quỹ ngày phép còn lại

### GET `/leave-requests/:id` — Chi tiết đơn

### PUT `/leave-requests/:id/approve` — Phê duyệt đơn (Admin, Trưởng Khoa)
- **Body (tùy chọn):**
```json
{ "approvalNote": "Đã duyệt theo đề nghị của tổ bộ môn" }
```

### PUT `/leave-requests/:id/reject` — Từ chối đơn (Admin, Trưởng Khoa)
- **Body (bắt buộc):**
```json
{ "rejectionReason": "Trùng lịch thi cuối kỳ, đề nghị chọn ngày khác" }
```

---

## 8. Reports (Báo Cáo) — `/api/reports`

### GET `/reports/attendance` — Báo cáo tổng hợp chấm công
- **Query:** `?userId=<id>&departmentId=<id>&from=2026-09-01&to=2026-09-30`
- **Response:**
```json
{
  "totalRecords": 150,
  "onTimeCount": 120,
  "lateCount": 15,
  "earlyLeaveCount": 5,
  "absentCount": 8,
  "excusedAbsenceCount": 2,
  "approvedLeaveDays": 3
}
```

### GET `/reports/monthly` — Báo cáo chi tiết theo tháng
- **Query:** `?month=9&year=2026&departmentId=<id>`
- **Quyền:** Admin (toàn trường), Trưởng Khoa (tự động lọc theo khoa)

---

## 9. AI Chat (Trợ lý AI) — `/api/ai`

### POST `/ai/chat` — Gửi câu hỏi cho Trợ lý AI
- **Body:**
```json
{ "question": "Hôm nay có bao nhiêu giảng viên đi muộn?" }
```
- **Hoạt động:**
  1. Thu thập dữ liệu chấm công, nghỉ phép, nhân sự từ MongoDB
  2. Nếu có `GEMINI_API_KEY` → gọi Google Gemini API với context
  3. Nếu không → dùng Fallback Analytics Engine (thống kê trực tiếp)
- **Response:** Trả về Markdown

---

## 10. Audit Logs (Nhật Ký Kiểm Toán) — `/api/audit-logs`

### GET `/audit-logs` — Danh sách nhật ký (Admin only)
- **Query:** `?actor=<userId>&action=DELETE&targetType=User&startDate=2026-09-01&endDate=2026-09-30`

---

## 11. Upload — `/api/upload`

### POST `/upload` — Tải file lên
- **Content-Type:** `multipart/form-data`
- **Field:** `file`
- **Response:** `{ "data": { "url": "/uploads/filename.pdf" } }`

### GET `/uploads/:filename` — Tải file xuống (Token bắt buộc)

---

## 12. Trợ Lý AI (AI Assistant) — `/api/ai`

### POST `/ai/chat` — Hỏi đáp thống kê & phân tích chấm công
- **Quyền:** `admin`, `truongkhoa`, `giangvien`, `nhanvien`
- **Body:**
```json
{ "question": "Hôm nay có bao nhiêu trường hợp đi muộn và vắng mặt?" }
```
- **Response 200:**
```json
{
  "success": true,
  "message": "Phản hồi từ AI thành công.",
  "data": {
    "reply": "Dựa trên dữ liệu thực tế hệ thống: Hôm nay ghi nhận 1 trường hợp đi muộn và 0 trường hợp vắng mặt...",
    "source": "gemini-1.5-flash"
  }
}
```

---

## 13. Health Check — `/api/health`

### GET `/health` — Kiểm tra trạng thái hệ thống
- **Không yêu cầu xác thực**
- **Response:**
```json
{
  "status": "OK",
  "message": "Hệ thống đang hoạt động bình thường.",
  "collectionsCount": 9,
  "timestamp": "2026-09-19T08:00:00.000Z"
}
```

---

## 📋 Mã Trạng Thái Chấm Công

| Mã | Ý nghĩa |
|----|---------|
| `ON_TIME` | Đúng giờ (check-in ≤ startTime + lateThreshold) |
| `LATE` | Đi muộn (check-in > startTime + lateThreshold) |
| `EARLY_LEAVE` | Về sớm (check-out < endTime - earlyExitThreshold) |
| `ABSENT` | Vắng mặt (Cron job tạo khi hết ca mà chưa check-in) |
| `EXCUSED_ABSENCE` | Vắng có phép (Admin chỉnh sửa khi có đơn nghỉ) |

---

## 📋 Mã Lỗi (Error Codes)

| Error Code | Mô tả |
|------------|-------|
| `ATTENDANCE_ALREADY_EXISTS` | Đã check-in ca này hôm nay rồi (409) |
| `ATTENDANCE_NO_MATCHING_SCHEDULE` | Không có lịch phù hợp tại thời điểm này (400) |
| `SHIFT_NOT_FOUND` | Không tìm thấy ca làm việc (404) |
