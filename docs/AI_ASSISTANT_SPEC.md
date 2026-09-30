# 🤖 ĐẶC TẢ KỸ THUẬT PHÂN HỆ TRỢ LÝ ẢO AI ASSISTANT & AUGMENTED ANALYTICS

> **Hệ thống:** Quản lý chấm công cán bộ, giảng viên trường đại học  
> **Module:** AI Assistant (`/api/ai/chat` & Web Frontend `/ai-assistant`)  
> **Kiến trúc:** Augmented Analytics & Deterministic Natural Language Generation  

---

## 🏛️ 1. Tổng Quan Kiến Trúc & Quy Trình Xử Lý

### 1.1. Triết lý thiết kế (Zero Hallucination Principle)
Khác với các hệ thống chatbot thông thường đưa toàn bộ prompt và mong muốn LLM tự tính toán dẫn tới hiện tượng "ảo giác" (hallucination), Phân hệ Trợ lý AI được thiết kế theo nguyên tắc:
1. **MongoDB là nguồn chân lý duy nhất (Single Source of Truth)**: LLM (Google Gemini) tuyệt đối không tự tính toán, dự đoán hoặc bịa đặt số liệu thống kê.
2. **Deterministic Calculation**: Mọi phép tính số ngày công, lượt đi trễ, số buổi giảng dạy (bao gồm giải mã lịch lặp `isRecurring`) đều được thực thi 100% bằng **Analytics Engine** trên MongoDB trước khi gửi kết quả cho LLM.
3. **LLM chỉ đóng vai trò Formatting & Persona**: Gemini tiếp nhận dữ liệu đã được tính toán chính xác để sinh ra câu trả lời tiếng Việt theo văn phong sư phạm, lịch thiệp và mạch lạc.
4. **Offline / Fallback Resilience**: Nếu mất kết nối Internet hoặc không có `GEMINI_API_KEY`, hệ thống tự động kích hoạt **Deterministic Markdown Engine**, đảm bảo dịch vụ luôn phản hồi tức thì mà không bao giờ báo lỗi crash.

---

### 1.2. Quy trình xử lý tuần tự 7 bước (Pipeline)

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

1. **Nhận câu hỏi**: Người dùng gửi tin nhắn qua Web Chat hoặc API `POST /api/ai/chat`.
2. **Xác thực JWT**: Middleware `verifyToken` trích xuất `req.user` (`id`, `role`, `departmentId`).
3. **Intent & Date Parsing**:
   - `aiDateParser.js`: Chuẩn hóa thời gian theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7).
   - `aiIntentParser.js`: Bóc tách ý định câu hỏi và nhận diện thực thể (cán bộ, khoa/bộ môn).
4. **Security & Permission Enforcer**: Kiểm tra ma trận phân quyền RBAC 4 cấp, từ chối ngay nếu người dùng hỏi vượt thẩm quyền.
5. **Analytics Query Engine**: Truy vấn MongoDB có sử dụng index, tính toán ra các con số thống kê chính xác.
6. **Response Generation Engine**: Đưa dữ liệu thô đã tính toán cho Gemini API (hoặc Rule-based Markdown Generator) để sinh câu trả lời tự nhiên.
7. **Trả kết quả**: Phản hồi về giao diện Web kèm metadata thống kê (hiển thị badges trực quan).

---

### 1.3. Bảng ánh xạ CSDL MongoDB & Nghiệp vụ

| Khái niệm nghiệp vụ | Collection MongoDB | Model Mongoose | Các trường dữ liệu cốt lõi | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Nhân sự & Người dùng** | `users` | `User` | `fullName`, `email`, `role`, `departmentId`, `annualLeaveQuota`, `isActive` | Quản lý thông tin giảng viên, nhân viên, phân quyền RBAC và hạn mức phép năm |
| **Điểm danh & Chấm công** | `attendance_logs` | `AttendanceLog` | `userId`, `shiftId`, `scheduleId`, `checkInTime`, `checkOutTime`, `status`, `leaveRequestId` | Trạng thái: `ON_TIME` (Đúng giờ), `LATE` (Trễ), `EARLY_LEAVE` (Về sớm), `ABSENT` (Vắng không phép), `EXCUSED_ABSENCE` (Vắng có phép) |
| **Đơn xin nghỉ & Dạy bù** | `leave_requests` | `LeaveRequest` | `userId`, `type` (`nghi_phep`, `day_bu`, `doi_ca`), `startDate`, `endDate`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `reason` | Quản lý các loại đơn từ của cán bộ giảng viên, xét duyệt theo cấp |
| **Lịch phân công giảng dạy** | `schedules` | `Schedule` | `userId`, `shiftId`, `weekday` (0-6), `startTime`, `endTime`, `roomId`, `subjectName`, `isRecurring`, `startDate`, `endDate` | Lịch dạy định kỳ (recurring) hoặc một lần của giảng viên theo học kỳ |
| **Đơn vị & Khoa/Bộ môn** | `departments` | `Department` | `name`, `type` (`khoa`, `bomon`, `phongban`), `parentId`, `managerId` | Cơ cấu tổ chức phân cấp hình cây (Ban Giám Hiệu ➔ Khoa ➔ Bộ môn) |
| **Ca làm việc** | `shift_configs` | `ShiftConfig` | `name`, `startTime`, `endTime`, `lateThresholdMinutes`, `isActive` | Cấu hình khung giờ bắt đầu, kết thúc ca và ngưỡng phút cho phép trễ |

---

## 🔒 2. Ma Trận Phân Quyền Bảo Mật (RBAC Matrix)

### 2.1. Nguyên tắc bảo mật bắt buộc
- **Thực thi tại Server**: LLM không có quyền tự quyết định cấp phép truy xuất. Mọi quyền hạn được kiểm tra tại code Node.js (`checkUserPermission` và `checkDepartmentPermission`).
- **Danh tính xác thực**: Chỉ tin tưởng `req.user` trích xuất từ JWT hợp lệ.
- **Từ chối lịch sự, không lộ số liệu**: Nếu vi phạm quyền, trả về thông điệp từ chối nêu rõ thẩm quyền và không đính kèm bất kỳ số liệu nào của người khác.

### 2.2. Ma trận phân quyền chi tiết

| Vai trò người dùng (`role`) | Tra cứu chính mình (`self`) | Tra cứu đồng nghiệp cùng Khoa | Tra cứu đồng nghiệp ngoài Khoa | Thống kê Khoa của mình | Thống kê Khoa khác | Thống kê toàn trường |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`giangvien`** | ✅ Cho phép | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối |
| **`nhanvien`** | ✅ Cho phép | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối |
| **`truongkhoa`** | ✅ Cho phép | ✅ Cho phép | ❌ Từ chối | ✅ Cho phép | ❌ Từ chối | ❌ Từ chối |
| **`admin`** | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép |

### 2.3. Quy định theo từng nhóm vai trò
- **Giảng viên / Nhân viên (`giangvien`, `nhanvien`)**:
  - *Được hỏi:* Lịch dạy cá nhân hôm nay/ngày mai, số lần đi trễ, số ngày vắng, số ngày nghỉ phép, trạng thái đơn nghỉ của bản thân.
  - *Bị từ chối:* Hỏi số liệu của giảng viên khác, hỏi tổng số người đi làm toàn trường hoặc thống kê của Khoa.
- **Trưởng khoa (`truongkhoa`)**:
  - *Được hỏi:* Số giảng viên có lịch dạy hôm nay trong Khoa, số lượt đi trễ/vắng của Khoa, tra cứu lịch dạy và ngày công của giảng viên thuộc Khoa/Bộ môn trực thuộc.
  - *Bị từ chối:* Hỏi số liệu của Khoa bạn hoặc thống kê cấp toàn trường.
- **Quản trị viên (`admin`)**:
  - Toàn quyền truy vấn mọi số liệu cá nhân, liên khoa và toàn trường.

---

## 🎯 3. Danh Mục 23 Query Intents & Xử Lý Ngôn Ngữ Tự Nhiên

### 3.1. Danh mục Intents hỗ trợ

| Mã Intent | Ý nghĩa câu hỏi | Ví dụ câu hỏi thực tế | Analytics Method |
| :--- | :--- | :--- | :--- |
| `ATTENDANCE_PRESENT_COUNT` | Đếm số người đi làm theo ngày/tuần/tháng | *"Hôm nay có bao nhiêu người đi làm?"* | `getAttendanceSummary` |
| `ATTENDANCE_LATE_COUNT` | Đếm số lượt đi trễ toàn trường hoặc theo Khoa | *"Hôm nay có bao nhiêu người đi trễ?"* | `getAttendanceSummary` |
| `ATTENDANCE_ABSENT_COUNT` | Đếm số lượt vắng không phép & có phép | *"Hôm nay có bao nhiêu người vắng?"*, *"Trong tháng này khoa CNTT có bao nhiêu lượt vắng?"* | `getAttendanceSummary` |
| `ATTENDANCE_TOP_LATE` | Tìm người đi trễ nhiều nhất trong khoảng thời gian | *"Trong tuần này ai đi trễ nhiều nhất?"* | `getTopLateUsers` |
| `ATTENDANCE_USER_LATE` | Số ngày đi trễ của một người | *"TS. Trần Thị Bích tháng này đi trễ bao nhiêu ngày?"* | `getAttendanceSummary` (userId) |
| `ATTENDANCE_USER_ON_TIME` | Số ngày đúng giờ của một người | *"Trần Thị Bích tháng này chấm công đúng giờ bao nhiêu ngày?"* | `getAttendanceSummary` (userId) |
| `ATTENDANCE_USER_ABSENT` | Số ngày vắng của một người | *"Trần Thị Bích tháng này vắng bao nhiêu ngày?"* | `getAttendanceSummary` (userId) |
| `ATTENDANCE_USER_TOTAL` | Tổng số ngày phát sinh chấm công của một người | *"Trần Thị Bích tháng này tổng cộng bao nhiêu ngày chấm công?"* | `getAttendanceSummary` (userId) |
| `ATTENDANCE_USER_SUMMARY` | Báo cáo chi tiết chấm công cá nhân | *"Trần Thị Bích đúng giờ bao nhiêu lần, đi trễ bao nhiêu lần?"*, *"Tôi hôm nay chấm công thế nào?"* | `getAttendanceSummary` (userId) |
| `LEAVE_REQUEST_COUNT` | Đếm đơn nghỉ theo trạng thái (chờ/duyệt/từ chối) | *"Hôm nay có bao nhiêu đơn xin nghỉ?"*, *"Có bao nhiêu đơn nghỉ đang chờ duyệt?"*, *"Tuần này có bao nhiêu đơn bị từ chối?"* | `getLeaveRequestSummary` |
| `LEAVE_REQUEST_USER_DAYS` | Tổng số ngày nghỉ phép của một người | *"Tháng này tổng số ngày nghỉ của Trần Thị Bích là bao nhiêu?"* | `getLeaveRequestSummary` (userId) |
| `LEAVE_REQUEST_TYPE_COUNT` | Thống kê đơn theo loại: dạy bù hoặc đổi ca | *"Tuần này có bao nhiêu đơn dạy bù?"*, *"Có bao nhiêu đơn đổi ca đang chờ duyệt?"* | `getLeaveRequestSummary` (type) |
| `SCHEDULE_USER_CHECK` | Kiểm tra người dùng có lịch dạy hay không | *"Trần Thị Bích tuần này có lịch dạy không?"* | `countTeachingSessions` |
| `SCHEDULE_USER_COUNT` | Đếm số buổi dạy thực tế của một người | *"Trần Thị Bích tuần này dạy bao nhiêu buổi?"* | `countTeachingSessions` |
| `SCHEDULE_USER_DETAILS` | Xem chi tiết thời khóa biểu cá nhân | *"Hôm nay lịch giảng dạy của tôi như thế nào?"*, *"Ngày mai tôi có tiết dạy nào?"* | `countTeachingSessions` |
| `SCHEDULE_DEPT_TEACHERS_TODAY` | Đếm số giảng viên có lịch dạy trong ngày của Khoa | *"Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?"* | `countTeachersWithScheduleOnDate` |
| `GENERAL_REPORT` | Báo cáo tóm tắt tổng quan | *"Báo cáo chấm công tổng hợp tháng này"* | `getAttendanceSummary` + `getLeaveRequestSummary` |

---

### 3.2. Cơ chế bóc tách thực thể tiếng Việt thông minh
1. **Nhận diện đại từ "tôi", "mình"**:
   - Khi người dùng hỏi *"Lịch dạy của tôi hôm nay?"*, hệ thống tự động trích xuất `req.user.id`, đảm bảo tính bảo mật và thuận tiện tối đa.
2. **Khử tiền tố danh xưng & học hàm, học vị**:
   - Tự động chuẩn hóa các danh xưng: `thầy`, `cô`, `bác`, `anh`, `chị`, `cán bộ`, `giảng viên`.
   - Bóc tách học hàm, học vị: `GS.`, `PGS.`, `TS.`, `ThS.`, `CN.`, `Kỹ sư`.
   - *Ví dụ:* Cụm từ `"TS. Trần Thị Bích (KTPM)"` sẽ được phân giải chính xác về bản ghi người dùng `Trần Thị Bích`.
3. **Xử lý múi giờ Việt Nam (UTC+7)**:
   - Module `aiDateParser.js` cố định timezone `Asia/Ho_Chi_Minh`.
   - Phân tích các mốc ngôn ngữ tự nhiên: `"hôm nay"`, `"hôm qua"`, `"ngày mai"`, `"tuần này"`, `"tuần trước"`, `"tháng này"`, `"7 ngày gần nhất"`, `"tháng N/YYYY"`.

---

## 🧪 4. Báo Cáo Kiểm Thử Tự Động (54 Tests PASS)

Hệ thống được cài đặt bộ kiểm thử tự động toàn diện tại `src/tests/aiAssistant.test.js`, vượt qua 100% kịch bản kiểm thử:

1. **Xử lý Múi giờ & Khoảng thời gian (10 Tests)**: Đảm bảo độ chính xác của các mốc thời gian ngày, tuần, tháng và năm nhuận theo múi giờ UTC+7.
2. **Phân giải Danh tính & Danh xưng (4 Tests)**: Khử học hàm học vị, nhận diện đại từ xưng hô, phân giải alias phòng ban (CNTT, Kinh tế...).
3. **Ma trận Phân quyền RBAC (5 Tests)**: Kiểm tra chặn truy cập trái phép của giảng viên sang dữ liệu đồng nghiệp và dữ liệu toàn khoa.
4. **23 Câu hỏi Nghiệp vụ Cốt lõi (23 Tests)**: Xác thực từng intent trả về số liệu đúng từ MongoDB.
5. **Giải mã Lịch lặp Recurring Math (4 Tests)**: Đếm chính xác số buổi dạy thực tế rơi vào các thứ trong tuần thay vì chỉ đếm số lượng document.
6. **Xử lý Biên Dữ liệu & Ngoại lệ (3 Tests)**: Xử lý khi không có dữ liệu, khi người dùng trùng tên, khi người dùng bị khóa tài khoản.
7. **Kiểm thử Tích hợp Endpoint `POST /api/ai/chat` (5 Tests)**: Kiểm tra mã trạng thái HTTP (`401` thiếu token, `400` thiếu body, `200` có metadata).
