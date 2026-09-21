# 📖 AI Assistant Training & Extension Guide: Hướng Dẫn Mở Rộng & Cấu Hình

## 1. Cấu Hình Khóa Google Gemini API Key
Hệ thống AI Assistant hỗ trợ mô hình lai:
- Nếu **có `GEMINI_API_KEY`**: Hệ thống gửi kết quả đã tính toán từ MongoDB tới Google Gemini (`gemini-1.5-flash`) để diễn đạt câu trả lời tiếng Việt mềm mại, sinh động và tự nhiên nhất.
- Nếu **không có `GEMINI_API_KEY`** (hoặc lỗi mạng): Hệ thống tự động chuyển sang **Deterministic Fallback Engine** để tạo câu trả lời định dạng Markdown đầy đủ, chuẩn xác và không có ảo giác.

### Hướng dẫn cấu hình API Key:
1. Truy cập [Google AI Studio](https://aistudio.google.com/) và tạo một API Key miễn phí.
2. Mở file `.env` ở thư mục gốc của project:
   ```env
   GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere...
   ```
3. Khởi động lại server backend:
   ```bash
   npm run dev
   ```

---

## 2. Hướng Dẫn Thêm Một Loại Câu Hỏi Mới (New Intent)

Khi muốn AI hiểu một mẫu câu hỏi mới (Ví dụ: *"Hôm nay có bao nhiêu người về sớm?"*), bạn chỉ cần thực hiện 3 bước:

### Bước 1: Khai báo Intent mới trong `src/services/aiIntentParser.js`
1. Thêm hằng số vào `INTENTS`:
   ```javascript
   const INTENTS = {
     // ... các intent hiện có
     ATTENDANCE_EARLY_LEAVE_COUNT: 'ATTENDANCE_EARLY_LEAVE_COUNT',
   };
   ```
2. Thêm quy tắc nhận diện trong hàm `parseIntent`:
   ```javascript
   if (lower.includes('về sớm') || lower.includes('ve som')) {
     return {
       intent: INTENTS.ATTENDANCE_EARLY_LEAVE_COUNT,
       department: deptMatch,
       dateRange,
       rawQuestion: cleanQuestion,
     };
   }
   ```

### Bước 2: Bổ sung Analytics trong `src/controllers/ai.controller.js`
Trong khối `switch (intent)` của `handleAiChat`:
```javascript
case INTENTS.ATTENDANCE_EARLY_LEAVE_COUNT: {
  const result = await getAttendanceSummary({
    userId,
    departmentId,
    fromDate,
    toDate,
    currentUser,
  });

  if (result.unauthorized) {
    unauthorizedReason = result.reason;
  } else {
    statistics = {
      earlyLeaveCount: result.earlyLeave,
      total: result.total,
    };
  }
  break;
}
```

### Bước 3: Định dạng câu trả lời trong `src/services/aiResponse.service.js`
Trong hàm `generateFallbackResponse`:
```javascript
case 'ATTENDANCE_EARLY_LEAVE_COUNT': {
  const earlyCount = statistics?.earlyLeaveCount || 0;
  if (earlyCount === 0) {
    return `### 🚪 Thống Kê Về Sớm\n\nTrong ${timeLabel}, tại ${deptName} **không có ai về sớm**. Toàn bộ nhân sự chấp hành nghiêm túc giờ làm việc!`;
  }
  return `### 🚪 Thống Kê Về Sớm\n\nTrong ${timeLabel}, tại ${deptName} ghi nhận **${earlyCount} lượt về sớm**.`;
}
```

---

## 3. Hướng Dẫn Thêm Tool Phân Tích Mới Vào Analytics Engine (`aiAnalytics.service.js`)

Khi cần viết thêm hàm truy vấn CSDL phức tạp (ví dụ: thống kê tỷ lệ chuyên cần theo học kỳ):
1. Mở `src/services/aiAnalytics.service.js`.
2. Tạo hàm mới tuân thủ nghiêm ngặt việc truyền `currentUser` để kiểm tra quyền:
   ```javascript
   const calculateSemesterAttendanceRate = async ({ departmentId, semesterStartDate, semesterEndDate, currentUser }) => {
     // 1. Kiểm tra phân quyền
     const perm = await checkDepartmentPermission(currentUser, departmentId);
     if (!perm.allowed) {
       return { unauthorized: true, reason: perm.reason };
     }

     // 2. Truy vấn MongoDB với index tối ưu
     // ... logic tính toán

     return {
       totalLectures: 100,
       attendedLectures: 95,
       rate: 95.0,
     };
   };
   ```
3. Export hàm và sử dụng trong Controller hoặc Test Case.

---

## 4. Hướng Dẫn Chạy Kiểm Thử Sau Khi Nâng Cấp
Sau khi thêm tính năng hoặc intent mới, chạy lệnh sau để kiểm tra:
```bash
npm test
```
Đảm bảo tất cả các bài test đều hiển thị `[PASS]` trước khi triển khai sản phẩm.
