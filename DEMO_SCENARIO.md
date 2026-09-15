# KỊCH BẢN THUYẾT MINH & TRÌNH DIỄN DEMO ĐỒ ÁN (DEMO SCENARIO)

## HỆ THỐNG QUẢN LÝ CHẤM CÔNG CHO TRƯỜNG ĐẠI HỌC
**Nền tảng:** Node.js (Express 5) - MongoDB (Mongoose 9) - JWT RBAC - Multer - Swagger UI  
**Thành viên thực hiện:** TV C (Quản lý Đơn nghỉ phép, Kiểm toán & Báo cáo thống kê)  
**Thời lượng dự kiến:** 10 - 15 phút  

---

## I. MỤC TIÊU CỦA BUỔI DEMO
1. Minh chứng toàn bộ các yêu cầu từ **Tuần 1 đến Tuần 5** đã được hiện thực hóa 100% trong mã nguồn.
2. Chứng minh hệ thống hoạt động ổn định, bảo mật cao với phân quyền đa cấp bậc (Admin, Trưởng khoa, Giảng viên, Chuyên viên).
3. Chứng minh tính toàn vẹn của quy trình: **Nộp đơn kèm file minh chứng thực tế $\rightarrow$ Phê duyệt phân cấp $\rightarrow$ Tự động đồng bộ sang bảng điểm danh $\rightarrow$ Gửi email thông báo $\rightarrow$ Ghi nhật ký kiểm toán $\rightarrow$ Thống kê báo cáo**.

---

## II. CHUẨN BỊ MÔI TRƯỜNG TRƯỚC KHI DEMO

### 1. Khởi động CSDL và nạp dữ liệu chuẩn:
```bash
# Nạp dữ liệu mẫu (Khoa, Ca làm việc, 6 tài khoản mẫu, Lịch giảng dạy, Đơn mẫu)
npm run seed
```

### 2. Khởi động máy chủ:
```bash
npm run dev
# Máy chủ lắng nghe tại http://localhost:5000
# Swagger UI tại http://localhost:5000/api-docs
```

### 3. Danh sách tài khoản thử nghiệm:
| Vai trò | Email | Mật khẩu | Chức năng chính trong kịch bản |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `daihocdtd@gmail.com` | `password123` | Phê duyệt đơn của Trưởng khoa, xem toàn bộ Audit Log và Báo cáo toàn trường |
| **Trưởng khoa CNTT** | `truongkhoa.cntt@university.edu.vn` | `password123` | Phê duyệt/từ chối đơn của giảng viên trong khoa, xem báo cáo khoa |
| **Giảng viên 1** | `giangvien.bich@university.edu.vn` | `password123` | Nộp đơn có file minh chứng, xem quỹ phép cá nhân, xem báo cáo cá nhân |
| **Giảng viên 2** | `giangvien.cuong@university.edu.vn` | `password123` | Giảng viên có đơn cần xét duyệt |

---

## III. KỊCH BẢN CHI TIẾT THEO TỪNG BƯỚC (STEP-BY-STEP)

### 🟢 BƯỚC 1: Kiểm tra tình trạng hạ tầng & Swagger UI (Tuần 1 & 5)
- **Hành động:** 
  1. Mở trình duyệt truy cập `http://localhost:5000/health`.
  2. Truy cập giao diện tài liệu động `http://localhost:5000/api-docs`.
- **Lời thuyết minh:** 
  *"Hệ thống đang hoạt động với trạng thái OK, kết nối chuẩn 9 collections MongoDB. Toàn bộ các API đều được đặc tả minh bạch và trực quan trên giao diện Swagger UI."*
- **Kết quả kỳ vọng:** HTTP 200 OK, hiển thị đầy đủ danh mục API phân theo từng nhóm phân hệ.

---

### 🟢 BƯỚC 2: Giảng viên nộp đơn nghỉ phép kèm file minh chứng thực tế (Tuần 1 & 2)
- **Vai trò:** Giảng viên TS. Trần Thị Bích (`giangvien.bich@university.edu.vn`)
- **Tình huống nghiệp vụ:** Giảng viên cần nghỉ 2 ngày để điều trị sức khỏe và có giấy chứng nhận của bệnh viện (file scan PDF/ảnh).
- **Hành động 2.1 (Upload file qua API `/api/upload`):**
  - Gửi `POST /api/upload` (Form-data: `file = giay_kham_benh.pdf`).
  - Hệ thống trả về `fileUrl: "/uploads/attachment-xxx.pdf"`.
  - Mở URL trên trình duyệt để kiểm tra server trả về file tĩnh chuẩn xác.
- **Hành động 2.2 (Tạo đơn `POST /api/leave-requests`):**
  - Gửi kèm `type = "nghi_phep"`, ngày bắt đầu, ngày kết thúc và `attachmentUrl`.
  *(Hoặc gửi trực tiếp `multipart/form-data` tại `/api/leave-requests`)*.
- **Lời thuyết minh:** 
  *"Hệ thống hỗ trợ tải file minh chứng thực tế với cơ chế kiểm duyệt định dạng an toàn (PDF, PNG, JPG, DOCX) và dung lượng tối đa 10MB, lưu trữ tại thư mục tĩnh có thể truy cập trực tiếp."*

---

### 🟢 BƯỚC 3: Giảng viên kiểm tra số dư ngày phép (Leave Balance) (Tuần 3)
- **Vai trò:** Giảng viên TS. Trần Thị Bích
- **Hành động:** Gửi `GET /api/leave-requests/balance`.
- **Lời thuyết minh:** 
  *"Hệ thống tính toán ĐỘNG số dư ngày phép thông qua MongoDB Aggregation pipeline dựa trên các đơn đã được duyệt trong năm hiện tại, lấy hạn mức trừ đi tổng số ngày nghỉ thực tế, không dùng trường lưu cứng."*
- **Thử nghiệm bảo mật RBAC:** Giảng viên cố tình gọi `GET /api/leave-requests/balance?userId={id_admin}`.
- **Kết quả:** Hệ thống trả về `403 Forbidden` (*"Bạn chỉ có quyền tra cứu số dư ngày phép của chính mình"*).

---

### 🟢 BƯỚC 4: Trưởng khoa phê duyệt đơn & Kiểm tra tính đồng bộ (Tuần 3)
- **Vai trò:** Trưởng khoa PGS. TS. Lê Hoàng Nam (`truongkhoa.cntt@university.edu.vn`)
- **Tình huống nghiệp vụ:** Trưởng khoa xem danh sách đơn chờ duyệt của Khoa CNTT và phê duyệt đơn của TS. Trần Thị Bích.
- **Hành động:**
  1. `GET /api/leave-requests?status=PENDING` $\rightarrow$ Thấy đơn vừa tạo.
  2. `PUT /api/leave-requests/{id}/approve` kèm ghi chú `approvalNote: "Đồng ý cho giảng viên nghỉ điều trị"`.
- **Kết quả nghiệp vụ tự động diễn ra:**
  1. Trạng thái đơn đổi thành `APPROVED`.
  2. Bản ghi điểm danh trong `attendance_logs` tự động được gán `status = "EXCUSED_ABSENCE"` (nghỉ có phép) cho các buổi dạy trong khung giờ xin nghỉ.
  3. Hệ thống gửi email thông báo kết quả duyệt đơn đến email giảng viên.
  4. Một bản ghi `audit_logs` được tạo tự động với hành động `APPROVE_LEAVE`.
- **Lời thuyết minh:** 
  *"Điểm cốt lõi là sự liên kết chặt chẽ giữa Module Đơn nghỉ phép và Module Điểm danh: ngay khi đơn được duyệt, hệ thống tự động giải quyết các tiết dạy thành 'Vắng có phép', bảo đảm quyền lợi cho giảng viên."*

---

### 🟢 BƯỚC 5: Trưởng khoa từ chối đơn sai quy định (Tuần 3)
- **Vai trò:** Trưởng khoa
- **Hành động:** 
  - Thử từ chối một đơn mà **không gửi** `rejectionReason` $\rightarrow$ Nhận lỗi 400 (*"Lý do từ chối là bắt buộc"*).
  - Gửi `PUT /api/leave-requests/{id}/reject` kèm lý do cụ thể $\rightarrow$ Thành công.
  - Ghi vết `REJECT_LEAVE` vào `audit_logs` và gửi email thông báo từ chối.

---

### 🟢 BƯỚC 6: Phân cấp phê duyệt theo cấp bậc (RBAC Cấp 2) (Tuần 3)
- **Tình huống kiểm thử:** Trưởng khoa nộp đơn xin nghỉ của chính mình.
- **Kiểm thử 6.1:** Trưởng khoa cố tình tự duyệt đơn của mình $\rightarrow$ Bị chặn `403 Forbidden` (*"Bạn không thể tự xử lý đơn của chính mình"*).
- **Kiểm thử 6.2:** Admin (`daihocdtd@gmail.com`) đăng nhập và thực hiện duyệt đơn của Trưởng khoa $\rightarrow$ Thành công!
- **Lời thuyết minh:** 
  *"Hệ thống tuân thủ chặt chẽ quy chế quản trị trường đại học: Trưởng khoa quản lý giảng viên trong khoa, còn cấp trên trực tiếp của Trưởng khoa là Ban Giám hiệu / Admin trường."*

---

### 🟢 BƯỚC 7: Báo cáo thống kê chấm công phân quyền (Tuần 4)
- **Hành động 7.1 (Giảng viên):**
  - Giảng viên gọi `GET /api/reports/attendance`.
  - Hệ thống tự động giới hạn chỉ trả về dữ liệu của chính giảng viên (số lần đúng giờ, đi muộn, về sớm, vắng có phép, số ngày đã nghỉ phép).
- **Hành động 7.2 (Trưởng khoa):**
  - Trưởng khoa gọi `GET /api/reports/attendance` $\rightarrow$ Thống kê toàn bộ cán bộ, giảng viên trong Khoa CNTT.
  - Gọi `GET /api/reports/monthly?month=10&year=2026` $\rightarrow$ Báo cáo tổng hợp số ngày làm việc chi tiết từng người.
- **Hành động 7.3 (Admin):**
  - Admin xem báo cáo toàn trường hoặc lọc theo bất kỳ khoa/giảng viên nào.

---

### 🟢 BƯỚC 8: Tra cứu Nhật ký kiểm toán an toàn (Audit Logs) (Tuần 1 & 5)
- **Vai trò:** Admin
- **Hành động:**
  - Gọi `GET /api/audit-logs`.
  - Kiểm tra các vết kiểm toán đã phát sinh trong các bước trước:
    - Thao tác `APPROVE_LEAVE` của Trưởng khoa.
    - Thao tác `REJECT_LEAVE` của Trưởng khoa.
    - Thao tác `APPROVE_LEAVE` của Admin đối với đơn của Trưởng khoa.
    - Kèm IP Address và Timestamp chính xác.
- **Thử nghiệm bảo mật:** Giảng viên hoặc Trưởng khoa gọi `GET /api/audit-logs` $\rightarrow$ Bị từ chối với lỗi `403 Forbidden` (Chỉ Admin mới có quyền truy cập nhật ký kiểm toán).

---

## IV. TỔNG KẾT & TRẢ LỜI CÂU HỎI
1. Hệ thống đã hoàn thành đầy đủ và vượt tiến độ các mục tiêu từ Tuần 1 đến Tuần 5.
2. Mã nguồn được cấu trúc chặt chẽ theo Layered MVC, có tài liệu Swagger và Postman đi kèm, sẵn sàng nghiệm thu.
