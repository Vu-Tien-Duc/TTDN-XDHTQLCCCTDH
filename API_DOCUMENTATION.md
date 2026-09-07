# TÀI LIỆU ĐẶC TẢ API - HỆ THỐNG QUẢN LÝ CHẤM CÔNG TRƯỜNG ĐẠI HỌC

> **Phiên bản:** 1.0.0  
> **Môi trường cục bộ:** `http://localhost:5000/api` hoặc `http://localhost:5000/api/v1`  
> **Cơ sở dữ liệu:** MongoDB (Đúng chuẩn 8 collections)  
> **Định dạng dữ liệu:** JSON (Content-Type: `application/json`)  
> **Xác thực:** JWT Bearer Token (`Authorization: Bearer <token>`)

---

## 🔑 TÀI KHOẢN DÙNG THỬ (ĐÃ SEED SẴN VÀO CSDL)

Tất cả tài khoản dùng chung mật khẩu: **`password123`**

| Vai trò | Họ tên | Email | ID Người Dùng (Mẫu) |
| :--- | :--- | :--- | :--- |
| **Admin** | Quản Trị Viên Hệ Thống | `admin@university.edu.vn` | `6a9d57378cf3a6165de25dd6` |
| **Trưởng Khoa** | PGS. TS. Lê Hoàng Nam | `truongkhoa.cntt@university.edu.vn` | `6a9d57378cf3a6165de25dd7` |
| **Giảng Viên 1** | TS. Trần Thị Bích (Có lịch hôm nay) | `giangvien.bich@university.edu.vn` | `6a9d57378cf3a6165de25dd8` |
| **Giảng Viên 2** | ThS. Phạm Văn Cường (Có đơn PENDING) | `giangvien.cuong@university.edu.vn` | `6a9d57378cf3a6165de25dd9` |
| **Giảng Viên 3** | ThS. Hoàng Diệu Linh | `giangvien.linh@university.edu.vn` | `6a9d57378cf3a6165de25dda` |
| **Nhân Viên** | Đỗ Thu Hà | `nhanvien.ha@university.edu.vn` | `6a9d57378cf3a6165de25ddb` |

---

## MỤC LỤC CÁC PHÂN HỆ
- [3.1 Phân hệ Xác thực & Người dùng (Auth & User)](#31-phân-hệ-xác-thực--người-dùng-auth--user)
- [3.2 Phân hệ Cơ cấu Tổ chức (Department)](#32-phân-hệ-cơ-cấu-tổ-chức-department)
- [3.3 Phân hệ Ca làm việc & Lịch công tác (Schedule & Shift Config)](#33-phân-hệ-ca-làm-việc--lịch-công-tác-schedule--shift-config)
- [3.4 Phân hệ Chấm công (Attendance)](#34-phân-hệ-chấm-công-attendance)
- [3.5 Phân hệ Đơn xin nghỉ phép & Đổi ca (Leave Request)](#35-phân-hệ-đơn-xin-nghỉ-phép--đổi-ca-leave-request)
- [3.6 Phân hệ Nhật ký Kiểm toán (Audit Log)](#36-phân-hệ-nhật-ký-kiểm-toán-audit-log)
- [3.7 Phân hệ Báo cáo Thống kê (Reports)](#37-phân-hệ-báo-cáo-thống-kê-reports)
- [3.8 Hạ tầng Kỹ thuật (Swagger UI & Health Check)](#38-hạ-tầng-kỹ-thuật-swagger-ui--health-check)

---

## 3.1 Phân hệ Xác thực & Người dùng (Auth & User)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Admin | Tạo tài khoản người dùng mới (mã hóa bcrypt cost 12). |
| `POST` | `/api/auth/login` | Công khai | Đăng nhập hệ thống, trả Access Token + Refresh Token (7 ngày). |
| `POST` | `/api/auth/refresh` | Đã đăng nhập | Cấp lại Access Token mới từ Refresh Token. |
| `POST` | `/api/auth/logout` | Đã đăng nhập | Vô hiệu hóa và xóa Refresh Token khỏi CSDL. |
| `GET` | `/api/auth/me` | Đã đăng nhập | Lấy thông tin cá nhân hiện tại (ẩn passwordHash). |
| `GET` | `/api/users` | Admin / TrưởngKhoa | Danh sách người dùng, phân trang và lọc theo khoa. |
| `GET` | `/api/users/:id` | Admin / TrưởngKhoa | Xem chi tiết một người dùng. |
| `POST` | `/api/users` | Admin | Tạo mới giảng viên/nhân viên, thiết lập `annualLeaveQuota`. |
| `PUT` | `/api/users/:id` | Admin | Cập nhật thông tin tài khoản người dùng. |
| `DELETE` | `/api/users/:id` | Admin | Soft delete (`isActive = false`), không xóa vật lý. |

### Ví dụ Request / Response:

#### Đăng nhập (`POST /api/auth/login`)
- **Lưu ý quan trọng:** Đăng nhập sử dụng HTTP `POST` (không dùng `GET`).
- **Body:**
```json
{
  "email": "admin@university.edu.vn",
  "password": "password123"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "_id": "6a9d57378cf3a6165de25dd6",
      "fullName": "Quản Trị Viên Hệ Thống (Admin)",
      "email": "admin@university.edu.vn",
      "role": "admin",
      "departmentId": "6a9d57378cf3a6165de25dd0",
      "annualLeaveQuota": 15,
      "isActive": true
    }
  }
}
```

---

## 3.2 Phân hệ Cơ cấu Tổ chức (Department)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/departments` | Đã đăng nhập | Danh sách khoa/bộ môn/phòng ban (dạng cây phân cấp `?tree=true`). |
| `GET` | `/api/departments/:id` | Đã đăng nhập | Chi tiết một đơn vị trực thuộc. |
| `POST` | `/api/departments` | Admin | Tạo đơn vị mới, gắn `parentId` và `managerId`. |
| `PUT` | `/api/departments/:id` | Admin | Cập nhật tên, loại, tọa độ GPS hoặc người quản lý. |
| `DELETE` | `/api/departments/:id` | Admin | Xóa đơn vị (kiểm tra ràng buộc: từ chối xóa nếu còn nhân sự hoặc đơn vị con). |

#### Ví dụ Tạo đơn vị mới (`POST /api/departments`):
```json
{
  "name": "Bộ môn An Toàn Thông Tin",
  "type": "bomon",
  "parentId": "6a9d57378cf3a6165de25dd1",
  "location": {
    "lat": 21.028511,
    "lng": 105.854167
  }
}
```

---

## 3.3 Phân hệ Ca làm việc & Lịch công tác (Schedule & Shift Config)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/shifts` | Đã đăng nhập | Danh sách các ca làm việc chuẩn do Admin cấu hình. |
| `POST` | `/api/shifts` | Admin | Tạo ca mới (tên ca, giờ bắt đầu/kết thúc HH:mm, ngưỡng trễ). |
| `PUT` | `/api/shifts/:id` | Admin | Cập nhật cấu hình ca làm việc. |
| `DELETE` | `/api/shifts/:id` | Admin | Xóa ca (từ chối xóa nếu đang được lịch giảng dạy tham chiếu). |
| `GET` | `/api/schedules` | Đã đăng nhập | Danh sách lịch, lọc theo học kỳ (`startDate`, `endDate`). GV/NV chỉ thấy lịch của mình. |
| `GET` | `/api/schedules/:id` | Đã đăng nhập | Chi tiết một lịch cụ thể. |
| `POST` | `/api/schedules` | Admin / TrưởngKhoa | Tạo lịch mới, **bắt buộc** truyền `startDate`/`endDate`; kiểm tra không cho phép trùng khung giờ cùng ngày. |
| `PUT` | `/api/schedules/:id` | Admin / TrưởngKhoa | Cập nhật thông tin lịch hoặc điều chỉnh gia hạn học kỳ. |
| `DELETE` | `/api/schedules/:id` | Admin / TrưởngKhoa | Xóa lịch phân công. |

#### Ví dụ Tạo lịch (`POST /api/schedules`):
```json
{
  "userId": "6a9d57378cf3a6165de25dd8",
  "shiftId": "6a9d57378cf3a6165de25ddc",
  "roomId": "Giảng đường A2-301",
  "weekday": 2,
  "isRecurring": true,
  "startDate": "2026-01-15T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z"
}
```

---

## 3.4 Phân hệ Chấm công (Attendance)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/attendance/check-in` | Đã đăng nhập | **Body CHỈ nhận deviceId, location (tùy chọn) — KHÔNG nhận scheduleId/shiftId.** Backend tự suy luận lịch hiệu lực theo giờ Asia/Ho_Chi_Minh. |
| `POST` | `/api/attendance/check-out` | Đã đăng nhập | **Tự tìm bản ghi đang mở** trong ngày hôm nay theo giờ Asia/Ho_Chi_Minh — không nhận ID từ client. |
| `GET` | `/api/attendance/history` | Cá nhân / TrưởngKhoa / Admin | Lịch sử chấm công, phân trang, lọc theo tuần/tháng/trạng thái. |
| `GET` | `/api/attendance/:id` | Chủ sở hữu / TrưởngKhoa / Admin | Chi tiết một bản ghi chấm công. |
| `PUT` | `/api/attendance/:id` | Admin | Sửa log chấm công. **BẮT BUỘC** set `method = admin_override` và `isManualOverride = true`; tự động ghi Audit Log. |

#### Quy trình tự động hóa Check-in:
1. Lấy `userId` từ token xác thực.
2. Quy đổi thời gian về múi giờ `Asia/Ho_Chi_Minh` (UTC+7).
3. Lọc trong `schedules` các lịch có `userId` khớp, `weekday` trùng hôm nay, nằm trong khoảng `[startDate, endDate]`.
4. Chỉ giữ lại lịch mà thời điểm hiện tại nằm trong khoảng `[startTime - 30 phút, endTime]`.
5. Không có lịch nào thỏa mãn -> trả mã lỗi **`ATTENDANCE_004`**.
6. Có lịch thỏa mãn -> Tự gán `scheduleId`, `shiftId` và so sánh giờ để tính trạng thái `ON_TIME` hoặc `LATE`.

---

## 3.5 Phân hệ Đơn xin nghỉ phép & Đổi ca (Leave Request)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/leave-requests` | Đã đăng nhập | Tạo đơn xin nghỉ/dạy bù/đổi ca, kèm URL minh chứng đính kèm. |
| `GET` | `/api/leave-requests` | Cá nhân / TrưởngKhoa / Admin | Danh sách đơn, lọc theo trạng thái (`PENDING`, `APPROVED`, `REJECTED`). |
| `GET` | `/api/leave-requests/:id` | Chủ đơn / TrưởngKhoa / Admin | Chi tiết một đơn xin. |
| `PUT` | `/api/leave-requests/:id/approve` | TrưởngKhoa / Admin | Phê duyệt đơn xin, ghi nhận Audit Log. Không trừ trực tiếp vào trường lưu cứng. |
| `PUT` | `/api/leave-requests/:id/reject` | TrưởngKhoa / Admin | Từ chối đơn, **bắt buộc kèm `rejectionReason`**, ghi Audit Log. |
| `GET` | `/api/leave-requests/balance` | Đã đăng nhập | **Số ngày phép còn lại** của bản thân — TÍNH ĐỘNG qua Aggregation pipeline/reduce (cộng dồn SỐ NGÀY, không đếm số lá đơn). |

#### Ví dụ Từ chối đơn (`PUT /api/leave-requests/:id/reject`):
- **Body:**
```json
{
  "rejectionReason": "Trùng lịch thi chung của khoa, đề nghị đổi sang tuần sau."
}
```

---

## 3.6 Phân hệ Nhật ký Kiểm toán (Audit Log)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit-logs` | Admin | Tra cứu nhật ký các thao tác nhạy cảm (`APPROVE_LEAVE`, `REJECT_LEAVE`, `EDIT_ATTENDANCE`, v.v.), hỗ trợ lọc theo actor, action và thời gian. |

---

## 3.7 Phân hệ Báo cáo Thống kê (Reports)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/attendance` | Cá nhân / TrưởngKhoa / Admin | Thống kê số buổi `ON_TIME`, `LATE`, `EARLY_LEAVE`, `ABSENT`, `EXCUSED_ABSENCE` và số ngày nghỉ phép trong khoảng thời gian `from` đến `to`. |

---

## 3.8 Hạ tầng Kỹ thuật (Swagger UI & Health Check)

| Method | Endpoint | Quyền truy cập | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Công khai | Kiểm tra tình trạng hoạt động của API và danh sách 8 collections. |
| `GET` | `/api-docs` | Công khai | Giao diện Swagger UI trực quan hóa toàn bộ API. |
