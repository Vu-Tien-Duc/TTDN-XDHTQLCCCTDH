# 📡 AI Assistant API Documentation

## 1. Điểm Cuối (Endpoint)
- **Đường dẫn**: `POST /api/ai/chat`
- **Yêu cầu bảo mật**: Bắt buộc JWT Bearer Token trong Header (`Authorization: Bearer <access_token>`).
- **Phân quyền**: Tất cả các vai trò hợp lệ (`admin`, `truongkhoa`, `giangvien`, `nhanvien`) đều có thể truy cập. Quyền truy xuất dữ liệu chi tiết được Backend áp dụng tự động dựa trên thông tin trong Token (`req.user`), không nhận bất kỳ tham số quyền hạn nào từ client.

---

## 2. Request Payload

### Headers
```http
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Body
Hỗ trợ cả trường `message` hoặc `question`:
```json
{
  "message": "Nguyễn Văn A tháng này đi trễ bao nhiêu ngày?"
}
```

---

## 3. Response Payload

### 3.1. Phản Hồi Thành Công (HTTP 200)

```json
{
  "success": true,
  "message": "Phản hồi từ Trợ lý AI thành công.",
  "data": {
    "question": "Nguyễn Văn A tháng này đi trễ bao nhiêu ngày?",
    "answer": "### 📋 Thống Kê Đi Trễ\n\nTrong tháng này (09/2026), **Nguyễn Văn A** đã **đi trễ 2 ngày** (trên tổng số 18 lượt chấm công ghi nhận).",
    "intent": "ATTENDANCE_USER_LATE",
    "dateRange": {
      "from": "2026-08-31T17:00:00.000Z",
      "to": "2026-09-30T16:59:59.999Z",
      "label": "tháng này (9/2026)"
    },
    "targetUser": {
      "id": "64e0a7f1234567890abcdef1",
      "fullName": "TS. Nguyễn Văn A (Giảng viên KTPM)",
      "email": "giangvien.a@university.edu.vn",
      "role": "giangvien"
    },
    "department": null,
    "statistics": {
      "total": 18,
      "onTime": 15,
      "late": 2,
      "earlyLeave": 1,
      "absent": 0,
      "excusedAbsent": 0,
      "presentUserCount": 1
    },
    "unauthorized": false,
    "timestamp": "2026-09-20T15:20:00.000Z"
  }
}
```

### 3.2. Phản Hồi Khi Bị Từ Chối Quyền Hạn (HTTP 200 kèm cờ `unauthorized: true`)
Khi Giảng viên hỏi về dữ liệu của người khác hoặc toàn khoa:
```json
{
  "success": true,
  "message": "Phản hồi từ Trợ lý AI thành công.",
  "data": {
    "question": "Lê Hoàng Nam tháng này đi trễ bao nhiêu ngày?",
    "answer": "### ⛔ Từ Chối Quyền Truy Cập\n\nBạn chỉ có quyền tra cứu thông tin của chính mình, không có quyền xem thông tin của cán bộ/giảng viên khác.\n\n*Hệ thống quản lý chấm công áp dụng nghiêm ngặt phân quyền theo cấp bậc để bảo mật thông tin.*",
    "intent": "ATTENDANCE_USER_LATE",
    "unauthorized": true,
    "statistics": null,
    "timestamp": "2026-09-20T15:20:00.000Z"
  }
}
```

### 3.3. Phản Hồi Khi Trùng Tên (Disambiguation)
Khi trong hệ thống có nhiều cán bộ/giảng viên cùng tên:
```json
{
  "success": true,
  "message": "Yêu cầu làm rõ danh tính người dùng.",
  "data": {
    "question": "Nguyễn Văn A tuần này có lịch dạy không?",
    "answer": "### 🔍 Yêu Cầu Xác Nhận Danh Tính\n\nTôi tìm thấy **2 người** phù hợp với tên bạn vừa hỏi. Vui lòng nêu rõ họ tên đầy đủ hoặc mã nhân sự:\n\n1. **Nguyễn Văn A** (a1@uni.edu.vn) - Đơn vị: *Khoa CNTT* [Vai trò: `giangvien`]\n2. **Nguyễn Văn A** (a2@uni.edu.vn) - Đơn vị: *Khoa Kinh tế* [Vai trò: `giangvien`]",
    "intent": "SCHEDULE_USER_CHECK",
    "isAmbiguous": true,
    "matches": [
      {
        "id": "64e0a7f1234567890abcdef1",
        "fullName": "Nguyễn Văn A",
        "email": "a1@uni.edu.vn",
        "role": "giangvien",
        "departmentName": "Khoa CNTT & Chuyển đổi số"
      },
      {
        "id": "64e0a7f1234567890abcdef2",
        "fullName": "Nguyễn Văn A",
        "email": "a2@uni.edu.vn",
        "role": "giangvien",
        "departmentName": "Khoa Kinh Tế - QTKD"
      }
    ],
    "timestamp": "2026-09-20T15:20:00.000Z"
  }
}
```

### 3.4. Mã Lỗi Thường Gặp
- `401 Unauthorized`: Chưa cung cấp Bearer token hoặc Token đã hết hạn.
- `400 Bad Request`: Trường `message` hoặc `question` bị bỏ trống.
