# 🏛️ AI Assistant Architecture: Hệ Thống Quản Lý Chấm Công & Giảng Dạy

## 1. Tổng Quan Kiến Trúc
Hệ thống AI Assistant được xây dựng theo mô hình **Augmented Analytics & Natural Language Generation**:
- **Nguyên tắc bất biến**: CSDL MongoDB là nguồn dữ liệu chân lý duy nhất. LLM (Gemini) không nhận toàn bộ database vào prompt và tuyệt đối không tự tính toán hoặc đoán số liệu.
- **Quy trình xử lý tuần tự 7 bước**:
  1. Người dùng gửi câu hỏi tiếng Việt qua Web Frontend (`/ai-assistant`) hoặc API (`POST /api/ai/chat`).
  2. Middleware `verifyToken` xác thực JWT token và trích xuất danh tính người dùng (`req.user: { id, role, departmentId }`).
  3. **Intent Parser & Date Parser**: Nhận diện ý định (`intent`), chuẩn hóa khoảng thời gian theo múi giờ `Asia/Ho_Chi_Minh` (`[fromDate, toDate]`), và phân giải thực thể (giảng viên, khoa/bộ môn).
  4. **Security & Permission Scoper**: Kiểm tra ma trận phân quyền 4 cấp (`admin`, `truongkhoa`, `giangvien`, `nhanvien`) trước khi cho phép truy xuất dữ liệu.
  5. **Analytics Engine** (`aiAnalytics.service.js`): Thực hiện truy vấn có đánh index vào MongoDB, tính toán số buổi dạy thực tế (giải mã lịch lặp `isRecurring`), tổng hợp số ngày đúng giờ, trễ, vắng, số đơn nghỉ/dạy bù.
  6. **Response Engine** (`aiResponse.service.js`): Đưa số liệu đã tính toán chính xác cho Gemini API (hoặc Fallback Engine định dạng Markdown sư phạm) để sinh câu trả lời tiếng Việt hoàn chỉnh.
  7. Trả kết quả kèm metadata số liệu về Frontend để hiển thị trực quan (badges, cards, markdown).

```
                      +-------------------------------------------+
                      |               USER FRONTEND               |
                      |        (React + Tailwind + Lucide)        |
                      +-------------------------------------------+
                                            │
                                            ▼ POST /api/ai/chat (JWT Bearer)
                      +-------------------------------------------+
                      |         AUTH & SECURITY MIDDLEWARE        |
                      |       (verifyToken -> req.user)           |
                      +-------------------------------------------+
                                            │
                                            ▼
                      +-------------------------------------------+
                      |           AI INTENT & DATE PARSER         |
                      |  - parseVietnameseDateRange (UTC+7)       |
                      |  - resolveUser (thầy/cô/TS/đại từ tôi)    |
                      |  - resolveDepartment (CNTT, Kinh tế...)   |
                      +-------------------------------------------+
                                            │
                                            ▼
                      +-------------------------------------------+
                      |         SECURITY SCOPE ENFORCER           |
                      |  - Giangvien/Nhanvien: Chỉ xem mình       |
                      |  - Truongkhoa: Chỉ xem trong Khoa         |
                      |  - Admin: Toàn trường                     |
                      +-------------------------------------------+
                                            │
                                            ▼
                      +-------------------------------------------+
                      |         ANALYTICS QUERY ENGINE            |
                      |      (src/services/aiAnalytics.js)        |
                      |  - getAttendanceSummary                   |
                      |  - getLeaveRequestSummary                 |
                      |  - countTeachingSessions (Recurring math) |
                      |  - countTeachersWithScheduleOnDate        |
                      |  - getTopLateUsers                        |
                      +-------------------------------------------+
                                            │
                                            ▼ MongoDB Collections
                                 [users, attendance_logs,
                                  leave_requests, schedules,
                                  departments, shift_configs]
                                            │
                                            ▼ Calculated Exact Numbers
                      +-------------------------------------------+
                      |           AI RESPONSE SERVICE             |
                      |  - Gemini API (Prompt with exact data)    |
                      |  - Fallback Deterministic Markdown Engine |
                      +-------------------------------------------+
                                            │
                                            ▼
                      +-------------------------------------------+
                      |             FRONTEND CHAT UI              |
                      |   (Markdown + Stat Badges + Follow-ups)   |
                      +-------------------------------------------+
```

---

## 2. Bảng Ánh Xạ CSDL MongoDB & Nghiệp Vụ Thực Tế

| Khái niệm nghiệp vụ | Collection MongoDB | Model Mongoose | Các trường dữ liệu cốt lõi | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Nhân sự & Người dùng** | `users` | `User` | `fullName`, `email`, `role`, `departmentId`, `annualLeaveQuota`, `isActive` | Quản lý thông tin giảng viên, nhân viên, phân quyền RBAC và hạn mức phép năm |
| **Điểm danh & Chấm công** | `attendance_logs` | `AttendanceLog` | `userId`, `shiftId`, `scheduleId`, `checkInTime`, `checkOutTime`, `status`, `leaveRequestId` | Trạng thái: `ON_TIME` (Đúng giờ), `LATE` (Trễ), `EARLY_LEAVE` (Về sớm), `ABSENT` (Vắng không phép), `EXCUSED_ABSENCE` (Vắng có phép) |
| **Đơn xin nghỉ & Dạy bù** | `leave_requests` | `LeaveRequest` | `userId`, `type` (`nghi_phep`, `day_bu`, `doi_ca`), `startDate`, `endDate`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `reason` | Quản lý các loại đơn từ của cán bộ giảng viên, xét duyệt theo cấp |
| **Lịch phân công giảng dạy** | `schedules` | `Schedule` | `userId`, `shiftId`, `weekday` (0-6), `startTime`, `endTime`, `roomId`, `subjectName`, `isRecurring`, `startDate`, `endDate` | Lịch dạy định kỳ (recurring) hoặc một lần của giảng viên theo học kỳ |
| **Đơn vị & Khoa/Bộ môn** | `departments` | `Department` | `name`, `type` (`khoa`, `bomon`, `phongban`), `parentId`, `managerId` | Cơ cấu tổ chức phân cấp hình cây (Ban Giám Hiệu -> Khoa -> Bộ môn) |
| **Ca làm việc** | `shift_configs` | `ShiftConfig` | `name`, `startTime`, `endTime`, `lateThresholdMinutes`, `isActive` | Cấu hình khung giờ bắt đầu, kết thúc ca và ngưỡng phút cho phép trễ |

---

## 3. Các Thành Phần Mã Nguồn Chính
1. `src/utils/aiDateParser.js`:
   - Chuẩn hóa các mốc thời gian tiếng Việt (`hôm nay`, `hôm qua`, `ngày mai`, `tuần này`, `tuần trước`, `tháng này`, `tháng trước`, `7 ngày gần nhất`, `đầu tháng`, `cuối tháng`, `tháng N/YYYY`).
   - Múi giờ chuẩn: `Asia/Ho_Chi_Minh` (UTC+7), chặn hoàn toàn lỗi lệch 7 giờ của UTC.
2. `src/services/aiAnalytics.service.js`:
   - Thực thi các phép tính toán chính xác trên MongoDB (Attendance, LeaveRequest, Schedule, Top trễ, Lịch dạy hôm nay).
   - Giải mã lịch lặp `isRecurring`: Duyệt từng ngày trong khoảng thời gian để tính đúng số buổi rơi vào thứ quy định, không đếm đơn thuần số bản ghi schedule.
   - Cơ chế kiểm soát quyền hạn `checkUserPermission`, `checkDepartmentPermission`.
   - Phân giải danh tính `resolveUser`: Khử bỏ tiền tố danh xưng `thầy`, `cô`, `TS.`, `ThS.`, nhận diện đại từ `tôi`.
3. `src/services/aiIntentParser.js`:
   - Bộ phân loại ý định (Intent Classifier) trích xuất chính xác 23 loại câu hỏi thường gặp.
4. `src/services/aiResponse.service.js`:
   - Tích hợp Gemini 1.5 Flash + Fallback Markdown Generator hoạt động offline độc lập, đảm bảo không có ảo giác (hallucination).
5. `src/controllers/ai.controller.js`:
   - Controller tiếp nhận request, tích hợp pipeline và trả về response chuẩn hóa.
