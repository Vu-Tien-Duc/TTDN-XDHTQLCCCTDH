# BÁO CÁO TỔNG KẾT THỰC TẬP TỐT NGHIỆP

# HỆ THỐNG QUẢN LÝ CHẤM CÔNG CHO TRƯỜNG ĐẠI HỌC
### (Node.js RESTful API Backend)

---

## MỤC LỤC
1. [GIỚI THIỆU TỔNG QUAN ĐỀ TÀI](#1-giới-thiệu-tổng-quan-đề-tài)
2. [KIẾN TRÚC HỆ THỐNG VÀ CÔNG NGHỆ](#2-kiến-trúc-hệ-thống-và-công-nghệ)
3. [THIẾT KẾ CƠ SỞ DỮ LIỆU MONGODB](#3-thiết-kế-cơ-sở-dữ-liệu-mongodb)
4. [KẾT QUẢ TRIỂN KHAI CHI TIẾT THEO 5 TUẦN](#4-kết-quả-triển-khai-chi-tiết-theo-5-tuần)
   - [Tuần 1: LeaveRequest, AuditLog và Nodemailer](#tuần-1-leaverequest-auditlog-và-nodemailer)
   - [Tuần 2: Quản lý Đơn & Tích hợp Upload File Minh chứng Thực tế](#tuần-2-quản-lý-đơn--tích-hợp-upload-file-minh-chứng-thực-tế)
   - [Tuần 3: Phân cấp Phê duyệt, Email & Tính Động Quỹ Phép (Leave Balance)](#tuần-3-phân-cấp-phê-duyệt-email--tính-động-quỹ-phép-leave-balance)
   - [Tuần 4: Phân hệ Báo cáo Thống kê & Chuẩn hóa Phân quyền RBAC](#tuần-4-phân-hệ-báo-cáo-thống-kê--chuẩn-hóa-phân-quyền-rbac)
   - [Tuần 5: Tài liệu Hóa, Kịch bản Demo & Kiểm thử Tự động](#tuần-5-tài-liệu-hóa-kịch-bản-demo--kiểm-thử-tự-động)
5. [ĐÁNH GIÁ BẢO MẬT & KIỂM THỬ AN TOÀN](#5-đánh-giá-bảo-mật--kiểm-thử-an-toàn)
6. [KẾT LUẬN & HƯỚNG PHÁT TRIỂN](#6-kết-luận--hướng-phát-triển)

---

## 1. GIỚI THIỆU TỔNG QUAN ĐỀ TÀI

Hệ thống Quản lý Chấm công cho Trường Đại học là nền tảng số hóa toàn diện công tác quản trị nhân sự, thời khóa biểu và điểm danh cho đội ngũ Giảng viên, Chuyên viên trong trường đại học.

Đặc thù của trường đại học so với doanh nghiệp thông thường:
- Lịch làm việc không cố định theo giờ hành chính mà gắn liền với **tiết học, phòng học, học phần** và **khoa/bộ môn trực thuộc**.
- Quy trình xin nghỉ phép, dạy bù, đổi ca gắn liền với quyền lợi công tác và kế hoạch đào tạo của sinh viên.
- Cơ cấu tổ chức phân cấp rõ rệt: **Trường $\rightarrow$ Khoa $\rightarrow$ Bộ môn / Phòng ban**.

Phân hệ do Thành viên C phụ trách bao gồm:
- Phân hệ Quản lý Đơn xin nghỉ phép, Dạy bù và Đổi ca (kèm file minh chứng).
- Phân hệ Phê duyệt và Tính toán Động quỹ ngày phép (Leave Balance).
- Phân hệ Nhật ký kiểm toán an toàn (Audit Log).
- Phân hệ Báo cáo Thống kê Chấm công và Tổng hợp công theo tháng.

---

## 2. KIẾN TRÚC HỆ THỐNG VÀ CÔNG NGHỆ

### 2.1 Công nghệ cốt lõi
- **Ngôn ngữ & Runtime**: JavaScript (Node.js v20+)
- **Framework máy chủ**: Express.js (v5.x)
- **Cơ sở dữ liệu**: MongoDB với ODM Mongoose (v9.x)
- **Quản lý File**: Multer (xử lý upload `multipart/form-data`)
- **Gửi Email**: Nodemailer (hỗ trợ SMTP và fallback mock)
- **Tài liệu API**: Swagger UI Express & OpenAPI 3.0 JSDoc
- **Bảo mật**: JWT (JSON Web Token), Cookie-Parser (`httpOnly`), Bcrypt.js (cost 12), Helmet, CORS

### 2.2 Kiến trúc Layered MVC
Mã nguồn tuân thủ triệt để mô hình kiến trúc phân tầng:
- **`Routes`**: Định tuyến URL, bắt buộc middleware xác thực token (`verifyToken`) và phân quyền vai trò (`verifyRole`).
- **`Controllers`**: Tiếp nhận request, trích xuất dữ liệu, kiểm tra ràng buộc nghiệp vụ và phản hồi chuẩn hóa JSON qua `responseHandler`.
- **`Services`**: Tách biệt logic nghiệp vụ phức tạp (tính toán trạng thái chấm công, xuất báo cáo tháng, gửi mail thông báo).
- **`Models`**: Định nghĩa lược đồ Mongoose Schema, validation cấp dữ liệu, compound index và hooks.
- **`Middlewares`**: Xử lý cắt ngang (Cross-cutting concerns) gồm Auth JWT, RBAC, Upload File Filter, Error Handling tập trung.

---

## 3. THIẾT KẾ CƠ SỞ DỮ LIỆU MONGODB

Hệ thống thiết kế 9 Collections chuẩn:

| Collection | Mục đích sử dụng | Cơ chế tối ưu & Ràng buộc |
| :--- | :--- | :--- |
| `users` | Tài khoản cán bộ, giảng viên, nhân viên | Mật khẩu hash bcrypt cost 12, hạn mức phép `annualLeaveQuota` |
| `departments` | Đơn vị Trường, Khoa, Bộ môn | Phân cấp cha-con (`parentId`), tọa độ định vị GPS |
| `shift_configs` | Khung giờ ca học/ca làm việc | Giờ bắt đầu, giờ kết thúc, ngưỡng trễ (gracePeriod) |
| `schedules` | Lịch giảng dạy & công tác theo học kỳ | Compound index `{ userId: 1, weekday: 1, startDate: 1, endDate: 1 }` chống trùng lịch |
| `attendance_logs` | Nhật ký điểm danh check-in / check-out | Tự động khớp ca, cờ `isManualOverride` & `method = 'admin_override'` |
| `leave_requests` | Đơn nghỉ phép, dạy bù, đổi ca | Compound index `{ userId: 1, status: 1, type: 1 }`, đường dẫn file minh chứng `attachmentUrl` |
| `audit_logs` | Nhật ký kiểm toán các thao tác nhạy cảm | Index `{ actor: 1, timestamp: -1 }`, lưu vết IP, Action, Before/After |
| `refresh_tokens` | Quản lý phiên đăng nhập dài hạn | MongoDB TTL Index `{ expiresAt: 1 }` tự động dọn rác sau 7 ngày |
| `token_blacklists` | Danh sách token bị thu hồi khi Logout | MongoDB TTL Index tự động hủy sau khi Access Token hết hạn (15 phút) |

---

## 4. KẾT QUẢ TRIỂN KHAI CHI TIẾT THEO 5 TUẦN

### Tuần 1: LeaveRequest, AuditLog và Nodemailer
- **Model `leave_requests`**: 
  - Khai báo Schema chặt chẽ với Enum `['nghi_phep', 'day_bu', 'doi_ca']`.
  - Validate ràng buộc: `startDate <= endDate`, lý do từ 5 đến 500 ký tự.
  - Thiết lập Compound Index `{ userId: 1, status: 1, type: 1 }` phục vụ tính số dư phép.
- **Model `audit_logs`**:
  - Ghi nhận `actor` (ID người thao tác), `action` (APPROVE_LEAVE, REJECT_LEAVE, EDIT_ATTENDANCE...), `targetId`, `targetType`, `ipAddress`, `timestamp`, `details`.
- **Dịch vụ Email (Nodemailer)**:
  - Cấu hình transporter thông minh: Tự động kích hoạt khi có cấu hình `MAIL_USER`/`MAIL_PASSWORD` và chuyển sang chế độ an toàn (console mock) khi chạy dev/test mà không gây gián đoạn luồng nghiệp vụ.
- **Đánh giá Tuần 1**: ✅ **Hoàn thành 100%**.

---

### Tuần 2: Quản lý Đơn & Tích hợp Upload File Minh chứng Thực tế
- **Tạo 3 loại đơn**:
  - Đơn xin nghỉ phép (`nghi_phep`).
  - Đơn đăng ký dạy bù (`day_bu`).
  - Đơn xin đổi ca làm việc (`doi_ca`).
- **Nâng cấp Upload File thực tế**:
  - Tích hợp thư viện `multer` với middleware lưu trữ chuyên biệt `upload.middleware.js`.
  - Lưu file an toàn tại thư mục `uploads/` với tên file sinh ngẫu nhiên chống ghi đè: `attachment-{timestamp}-{random}.ext`.
  - Kiểm tra MIME Type nghiêm ngặt: chỉ cho phép ảnh (`image/png`, `image/jpeg`, `image/webp`) hoặc tài liệu (`application/pdf`, `.doc`, `.docx`). Giới hạn dung lượng tối đa 10MB.
  - Mở endpoint upload chuyên dụng `POST /api/upload`.
  - Đồng thời nâng cấp `POST /api/leave-requests` hỗ trợ nhận trực tiếp `multipart/form-data` hoặc nhận `attachmentUrl` từ JSON.
  - Phục vụ file tĩnh qua Express static: `/uploads/...`.
- **Đánh giá Tuần 2**: ✅ **Hoàn thành 100% (Đã khắc phục hoàn toàn điểm thiếu hụt ban đầu)**.

---

### Tuần 3: Phân cấp Phê duyệt, Email & Tính Động Quỹ Phép (Leave Balance)
- **Quy trình Phê duyệt / Từ chối đa cấp bậc (RBAC Cấp 2)**:
  - Giảng viên và Nhân viên chỉ được nộp đơn và theo dõi đơn của chính mình.
  - Trưởng khoa chỉ được phê duyệt/từ chối đơn của cán bộ, giảng viên thuộc khoa mình phụ trách (kể cả các bộ môn con trực thuộc).
  - Trưởng khoa tuyệt đối không được tự phê duyệt đơn của chính mình.
  - Đơn của Trưởng khoa bắt buộc phải do Quản trị viên (Admin) phê duyệt.
  - Khi từ chối (`reject`), bắt buộc phải cung cấp `rejectionReason`.
- **Tự động đồng bộ Chấm công (Cross-module Attendance Sync)**:
  - Khi đơn được phê duyệt (`APPROVED`), hệ thống tự động tìm các lịch công tác (`schedules`) nằm trong khoảng thời gian nghỉ và cập nhật bản ghi `attendance_logs` tương ứng thành `status: 'EXCUSED_ABSENCE'` (Nghỉ có phép), gán liên kết `leaveRequestId`.
- **Tính toán Động Quỹ Phép (Leave Balance)**:
  - Số ngày phép không lưu cứng mà được tính toán động (Real-time Calculation) bằng MongoDB Aggregation Pipeline: lọc các đơn `nghi_phep` có trạng thái `APPROVED` trong năm hiện tại, tính tổng số ngày thực nghỉ và lấy `quota - totalDaysUsed`.
  - Siết chặt bảo mật: Giảng viên chỉ được xem số dư của mình; Trưởng khoa xem của khoa; Admin xem toàn trường.
- **Đánh giá Tuần 3**: ✅ **Hoàn thành 100%**.

---

### Tuần 4: Phân hệ Báo cáo Thống kê & Chuẩn hóa Phân quyền RBAC
- **Khắc phục điểm lệch tài liệu**:
  - Tại `report.routes.js`, quyền truy cập của route `GET /api/reports/attendance` đã được cập nhật mở cho cả 4 vai trò: `['admin', 'truongkhoa', 'giangvien', 'nhanvien']`.
  - Trong Controller, hệ thống tự động nhận diện vai trò:
    - Giảng viên / Nhân viên: Tự động chỉ xem thống kê số buổi đúng giờ, muộn, về sớm, vắng, có phép của chính mình.
    - Trưởng khoa: Xem thống kê toàn khoa CNTT hoặc lọc theo nhân sự trong khoa.
    - Admin: Toàn quyền xem thống kê toàn trường hoặc lọc linh hoạt theo khoa/cá nhân.
- **Bổ sung API Báo cáo Tổng hợp Tháng (`GET /api/reports/monthly`)**:
  - Tích hợp service `generateMonthlyReport` cho phép Trưởng khoa và Admin xuất danh sách tổng hợp công tác của từng nhân sự trong tháng (tổng ngày dạy, số lần đúng giờ, đi muộn, về sớm, vắng mặt).
- **Đánh giá Tuần 4**: ✅ **Hoàn thành 100% (Đã đồng nhất mã nguồn và đặc tả tài liệu)**.

---

### Tuần 5: Tài liệu Hóa, Kịch bản Demo & Kiểm thử Tự động
- **Tài liệu Kịch bản Thuyết minh Demo (`DEMO_SCENARIO.md`)**:
  - Xây dựng kịch bản 8 bước trình diễn logic rõ ràng, đầy đủ các tình huống nghiệp vụ và kiểm thử bảo mật cho buổi bảo vệ đồ án tốt nghiệp.
- **Báo cáo Đồ án Tổng hợp (`PROJECT_REPORT.md`)**:
  - Tài liệu chi tiết hiện tại, tổng hợp toàn bộ kết quả kỹ thuật và nghiệp vụ của dự án.
- **Bộ Kiểm thử Tự động Toàn diện (`test_demo_all_weeks.js`)**:
  - Script tự động kiểm tra toàn bộ luồng nghiệp vụ từ Tuần 1 đến Tuần 5 với log màu sắc trực quan (PASS/FAIL).
- **Tài liệu API & Swagger UI**:
  - Cập nhật Swagger OpenAPI 3.0 với đầy đủ các phân hệ, bao gồm Upload file và Báo cáo tháng.
- **Đánh giá Tuần 5**: ✅ **Hoàn thành 100%**.

---

## 5. ĐÁNH GIÁ BẢO MẬT & KIỂM THỬ AN TOÀN

1. **Xác thực 2 tầng**:
   - Access Token ngắn hạn (15 phút) lưu trong Authorization Header.
   - Refresh Token dài hạn (7 ngày) lưu trong `httpOnly cookie` chống tấn công XSS.
2. **Thu hồi phiên làm việc (Revocation)**:
   - Cơ chế Token Blacklist lưu các Access Token bị vô hiệu hóa khi Logout.
3. **Phân quyền truy cập đa cấp (RBAC Matrix)**:
   - Được kiểm tra ở cả 2 tầng: Middleware định tuyến (`verifyRole`) và Controller logic (kiểm tra sở hữu tài nguyên và phân cấp khoa).
4. **Kiểm toán an toàn (Audit Trail)**:
   - Mọi thao tác nhạy cảm (phê duyệt đơn, từ chối đơn, điều chỉnh thủ công log điểm danh) đều được ghi nhận vĩnh viễn vào `audit_logs` kèm địa chỉ IP và dấu thời gian.
5. **An toàn Tải file (File Upload Security)**:
   - Kiểm tra MIME Type tại tầng nhị phân, giới hạn dung lượng 10MB, sinh tên file ngẫu nhiên ngăn ngừa tấn công Path Traversal / File Inclusion.

---

## 6. KẾT LUẬN & HƯỚNG PHÁT TRIỂN

### Kết luận
Phân hệ Quản lý Đơn nghỉ phép, Kiểm toán & Báo cáo Thống kê (TV C) đã hoàn thành xuất sắc 100% khối lượng công việc được giao theo kế hoạch 5 tuần, đáp ứng toàn diện cả về chiều sâu kỹ thuật, tính ổn định, độ bảo mật và tính thực tiễn cao đối với môi trường giáo dục đại học.

### Hướng phát triển tiếp theo
1. Tích hợp giải pháp lưu trữ đám mây phân tán (như AWS S3 / Cloudinary) cho các file minh chứng có dung lượng lớn.
2. Xuất báo cáo thống kê chấm công và ngày phép ra file định dạng Excel (`.xlsx`) hoặc PDF có chữ ký số.
3. Mở rộng thông báo đa kênh qua ứng dụng di động (Push Notification / Zalo ZNS).
