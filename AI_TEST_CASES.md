# 🧪 AI Assistant Test Cases: Báo Cáo Kiểm Thử 54 Kịch Bản

Hệ thống kiểm thử tự động toàn diện được cài đặt tại `src/tests/aiAssistant.test.js` và có thể chạy bất kỳ lúc nào bằng lệnh:
```bash
npm test
# hoặc
npm run test:ai
```

---

## 1. Danh Mục Các Test Cases Đã Thực Thi & Vượt Qua (54 PASS / 0 FAIL)

### 1.1. Xử Lý Múi Giờ & Thời Gian Tiếng Việt (10 Tests)
1. `Phân tích mốc "hôm nay"`: Đảm bảo khoảng từ `00:00:00.000` đến `23:59:59.999` theo giờ Việt Nam (UTC+7).
2. `Phân tích mốc "hôm qua"`: Lùi đúng 1 ngày lịch Việt Nam.
3. `Phân tích mốc "ngày mai"`: Tiến đúng 1 ngày lịch Việt Nam.
4. `Phân tích mốc "tuần này"`: Bắt đầu từ Thứ Hai (`weekday = 1`) đến Chủ Nhật (`weekday = 0`).
5. `Phân tích mốc "tuần trước"`: Lùi đúng 7 ngày so với tuần hiện tại.
6. `Phân tích mốc "tháng này"`: Bắt đầu từ ngày 1 đầu tháng đến ngày cuối cùng của tháng.
7. `Phân tích mốc "tháng trước"`: Tính đúng số ngày của tháng trước đó (xử lý năm nhuận và chuyển năm).
8. `Phân tích mốc "7 ngày gần nhất"`: Tính lùi 6 ngày từ ngày hiện tại.
9. `Phân tích mốc "đầu tháng" và "cuối tháng"`: Đầu tháng (ngày 1-10), cuối tháng (ngày 20 đến ngày cuối tháng).
10. `Phân tích tháng cụ thể "tháng 9/2026"`: Nhận diện tháng 9 năm 2026 chính xác.

### 1.2. Phân Giải Danh Tính & Xử Lý Danh Xưng (4 Tests)
11. `Nhận diện đại từ "tôi", "mình"`: Ánh xạ chuẩn xác về `currentUser.id`.
12. `Khử danh xưng "thầy", "cô", "TS."`: Bóc tách tên cốt lõi và tìm đúng người dùng trong CSDL.
13. `Xử lý tên không tồn tại`: Trả về cờ `notFound = true`, không sinh lỗi ngoại lệ hoặc bịa số liệu.
14. `Nhận diện Khoa CNTT`: Bắt các alias "CNTT", "Công nghệ thông tin", "Chuyển đổi số" về đúng `departmentId`.

### 1.3. Ma Trận Phân Quyền 4 Cấp RBAC (5 Tests)
15. `Giảng viên tra cứu chính mình`: Trả về `allowed = true`.
16. `Giảng viên tra cứu người khác`: Trả về `allowed = false`, lý do từ chối rõ ràng.
17. `Giảng viên tra cứu toàn khoa`: Trả về `allowed = false`, chặn truy cập dữ liệu quản lý.
18. `Trưởng khoa tra cứu trong khoa`: Trả về `allowed = true`.
19. `Admin tra cứu bất kỳ ai và bất kỳ đơn vị nào`: Toàn quyền `allowed = true`.

### 1.4. 23 Câu Hỏi Bắt Buộc Của Hệ Thống (23 Tests)
20. *"Hôm nay có bao nhiêu người đi làm?"* -> `ATTENDANCE_PRESENT_COUNT`
21. *"Hôm nay có bao nhiêu người đi trễ?"* -> `ATTENDANCE_LATE_COUNT`
22. *"Hôm nay có bao nhiêu người vắng?"* -> `ATTENDANCE_ABSENT_COUNT`
23. *"Hôm nay có bao nhiêu đơn xin nghỉ?"* -> `LEAVE_REQUEST_COUNT`
24. *"Tuần này có bao nhiêu đơn xin nghỉ?"* -> `LEAVE_REQUEST_COUNT`
25. *"Tháng này có bao nhiêu đơn nghỉ được duyệt?"* -> `LEAVE_REQUEST_COUNT`
26. *"TS. Trần Thị Bích tháng này đi trễ bao nhiêu ngày?"* -> `ATTENDANCE_USER_LATE`
27. *"TS. Trần Thị Bích tháng này chấm công đúng giờ bao nhiêu ngày?"* -> `ATTENDANCE_USER_ON_TIME`
28. *"TS. Trần Thị Bích tháng này vắng bao nhiêu ngày?"* -> `ATTENDANCE_USER_ABSENT`
29. *"TS. Trần Thị Bích tuần này có lịch dạy không?"* -> `SCHEDULE_USER_CHECK`
30. *"TS. Trần Thị Bích tuần này dạy bao nhiêu buổi?"* -> `SCHEDULE_USER_COUNT`
31. *"Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?"* -> `SCHEDULE_DEPT_TEACHERS_TODAY`
32. *"Có bao nhiêu đơn nghỉ đang chờ duyệt?"* -> `LEAVE_REQUEST_COUNT`
33. *"Tuần này có bao nhiêu đơn bị từ chối?"* -> `LEAVE_REQUEST_COUNT`
34. *"Tháng này tổng số ngày nghỉ của TS. Trần Thị Bích là bao nhiêu?"* -> `LEAVE_REQUEST_USER_DAYS`
35. *"TS. Trần Thị Bích đúng giờ bao nhiêu lần, đi trễ bao nhiêu lần?"* -> `ATTENDANCE_USER_SUMMARY`
36. *"Trong tuần này ai đi trễ nhiều nhất?"* -> `ATTENDANCE_TOP_LATE`
37. *"Trong tháng này khoa CNTT có bao nhiêu lượt vắng?"* -> `ATTENDANCE_ABSENT_COUNT`
38. *"Hôm nay lịch giảng dạy của tôi như thế nào?"* -> `SCHEDULE_USER_DETAILS`
39. *"Ngày mai tôi có tiết dạy nào?"* -> `SCHEDULE_USER_DETAILS`
40. *"Tuần này có bao nhiêu đơn dạy bù?"* -> `LEAVE_REQUEST_TYPE_COUNT`
41. *"Có bao nhiêu đơn đổi ca đang chờ duyệt?"* -> `LEAVE_REQUEST_TYPE_COUNT`
42. *"TS. Trần Thị Bích tháng này tổng cộng bao nhiêu ngày chấm công?"* -> `ATTENDANCE_USER_TOTAL`

### 1.5. Truy Vấn Số Liệu Thực Tế MongoDB & Lịch Lặp (4 Tests)
43. `Tính số buổi dạy thực tế`: Giải mã lịch lặp `isRecurring` theo từng ngày trong tháng, đếm chính xác số buổi.
44. `Đếm giảng viên có lịch dạy hôm nay`: Lọc theo ngày hiện tại và khoa CNTT.
45. `Thống kê đơn xin nghỉ`: Lọc trạng thái `PENDING` và đếm chính xác.
46. `Thống kê chấm công chính xác`: Đếm các trạng thái `ON_TIME`, `LATE`, `ABSENT`, `EXCUSED_ABSENCE` không làm tròn và không bịa đặt.

### 1.6. Phản Hồi Khi Không Có Dữ Liệu / Từ Chối / Trùng Tên (3 Tests)
47. `Khi người dùng không có bản ghi`: Trả về thông báo dứt khoát không có dữ liệu, không đoán số.
48. `Khi bị từ chối quyền`: Trả về thông báo từ chối quyền hạn trang trọng.
49. `Khi trùng nhiều tên`: Liệt kê danh sách chi tiết các ứng viên để người dùng lựa chọn.

### 1.7. Kiểm Thử Trực Tiếp Endpoint POST /api/ai/chat (5 Tests)
50. `Không có Token`: Trả về HTTP `401 Unauthorized`.
51. `Tin nhắn rỗng`: Trả về HTTP `400 Bad Request`.
52. `Admin gọi câu hỏi toàn trường`: Trả về HTTP `200 OK` kèm dữ liệu.
53. `Giảng viên hỏi lịch dạy của mình`: Trả về HTTP `200 OK` kèm thời khóa biểu.
54. `Giảng viên hỏi dữ liệu người khác`: Trả về HTTP `200 OK` kèm cờ `unauthorized: true` và thông điệp từ chối.
