# 🎯 AI Query Intents & Phân Loại Câu Hỏi

Tài liệu liệt kê danh mục toàn bộ các Intent được hỗ trợ trong hệ thống AI Assistant, kèm theo ví dụ câu hỏi mẫu tiếng Việt và cấu trúc dữ liệu trả về từ Analytics Engine.

---

## 1. Bảng Tổng Hợp Intent

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

## 2. Quy Tắc Phân Loại Cụ Thể

### 2.1. Nhận Diện Đại Từ Xưng Hô "Tôi"
Khi người dùng hỏi về:
- *"Lịch dạy của tôi hôm nay?"*
- *"Tôi hôm nay chấm công thế nào?"*
- *"Tuần này tôi đi trễ bao nhiêu lần?"*
- *"Đơn nghỉ của tôi đang trạng thái gì?"*

Hệ thống tự động gán `targetUser = req.user.id`, hoàn toàn không phụ thuộc vào chuỗi tên riêng gửi lên từ client.

### 2.2. Nhận Diện Danh Xưng Học Hàm, Học Vị & Nghề Nghiệp
Bộ parser tự động khử các tiền tố:
- Tiền tố xưng hô: `thầy`, `cô`, `bác`, `anh`, `chị`, `cán bộ`, `giảng viên`, `nhân viên`.
- Tiền tố học hàm/học vị: `GS.`, `PGS.`, `TS.`, `ThS.`, `CN.`, `Kỹ sư`.
Ví dụ: `"cô Bích"` hoặc `"TS. Trần Thị Bích (Giảng viên KTPM)"` đều được phân giải chuẩn xác về người dùng có họ tên `Trần Thị Bích`.
