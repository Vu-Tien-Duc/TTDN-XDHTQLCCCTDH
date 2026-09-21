# KỊCH BẢN DỰ PHÒNG 3 LỚP CHO BUỔI BẢO VỆ ĐỒ ÁN
**Phân hệ Face ID – Nhận diện khuôn mặt & Kiosk điểm danh tự động**
*Thành viên B phụ trách trình bày*

---

## Tổng quan

Buổi bảo vệ trước hội đồng có thể gặp rủi ro kỹ thuật bất ngờ (mất mạng, trình duyệt chặn camera, máy treo). Tài liệu này mô tả 3 phương án ưu tiên từ cao xuống thấp để đảm bảo luôn có thể trình diễn trọn vẹn.

---

## 🟢 Lớp 1 (Ưu tiên #1): Demo Webcam trực tiếp trên localhost

**Điều kiện**: Laptop demo có camera hoạt động, trình duyệt Chrome/Edge cho phép quyền camera.

### Kịch bản từng bước:
1. Mở Terminal, chạy Backend: `npm run dev` (Server khởi động tại `http://localhost:5000`)
2. Mở Terminal thứ 2, chạy Frontend: `cd frontend && npm run dev` (Vite khởi động tại `http://localhost:5173`)
3. Đăng nhập Admin: `daihocdtd@gmail.com` / `password123`
4. Vào sidebar **"Đăng Ký Face ID"** → Chọn giảng viên muốn đăng ký → Nhấn **"Mở Camera"**
5. Căn khuôn mặt vào **khung bầu dục** trên màn hình → Nhấn **"Chụp & Trích Xuất Vector"**
6. Hiển thị thanh xanh lá "128 đặc trưng sinh trắc học" → Nhấn **"Xác Nhận & Lưu Face ID"**
7. Mở tab mới: `http://localhost:5173/kiosk` → Camera tự động bật → Quét khuôn mặt
8. Popup kết quả: Tên giảng viên, trạng thái ON_TIME/LATE, Confidence Score, tiếng beep xác nhận

### Thời gian trình bày: ~3 phút

---

## 🟡 Lớp 2 (Dự phòng lỗi camera): Tải ảnh chân dung lên để nhận diện

**Điều kiện**: Camera bị chặn quyền, bị ứng dụng khác chiếm, hoặc webcam lỗi phần cứng.

### Chuẩn bị trước:
- Lưu sẵn **3 file ảnh chân dung** (.jpg, .png) chụp thẳng mặt rõ nét trên Desktop:
  - `face_admin.jpg` – Admin IT
  - `face_bich.jpg` – TS. Trần Thị Bích
  - `face_cuong.jpg` – ThS. Phạm Văn Cường

### Kịch bản từng bước:
1. Tại màn hình **"Đăng Ký Face ID"** → Chọn giảng viên
2. Thay vì nhấn "Mở Camera", nhấn nút **"Tải ảnh lên"** → Chọn file ảnh từ Desktop
3. AI xử lý ảnh tĩnh, trích xuất vector 128 số → Thanh xanh lá hiện lên
4. Nhấn **"Xác Nhận & Lưu Face ID"** để lưu
5. Tại màn hình Kiosk (`/kiosk`), nếu camera cũng bị lỗi → Nhấn nút **"📷 Tải ảnh minh chứng"** ở góc dưới phải
6. Chọn ảnh chân dung đúng người → Kiosk quét ảnh tĩnh → Hiển thị kết quả điểm danh

### Thời gian trình bày: ~2 phút

---

## 🔴 Lớp 3 (Dự phòng sập mạng / treo máy): Chiếu video quay sẵn

**Điều kiện**: MongoDB mất kết nối, máy tính bị treo, hoặc bất kỳ sự cố nào không thể demo trực tiếp.

### Chuẩn bị trước:
- Quay sẵn **1 video ngắn (60-90 giây, 1080p)** ghi lại trọn vẹn luồng:
  1. Admin đăng nhập → Vào Đăng ký Face ID → Chọn giảng viên
  2. Mở camera → Chụp → Trích xuất vector → Lưu Face ID
  3. Mở tab Kiosk → Camera quét tự động → Nhận diện thành công → Popup kết quả
- Lưu file: `Desktop/demo_faceid_kiosk.mp4`

### Kịch bản trình bày:
1. Thông báo hội đồng: *"Do sự cố kỹ thuật, em xin phép chiếu video demo đã chuẩn bị sẵn"*
2. Mở file video từ Desktop, phát toàn màn hình
3. Vừa phát vừa thuyết minh từng bước trong video

### Thời gian trình bày: ~1.5 phút

---

## Checklist trước buổi bảo vệ

| # | Hạng mục | Trạng thái |
|---|----------|:----------:|
| 1 | Backend `npm run dev` khởi động bình thường | ☐ |
| 2 | Frontend `npm run dev` khởi động bình thường | ☐ |
| 3 | Chạy `npm run seed` để có dữ liệu sạch (Face ID sẵn cho 5 người) | ☐ |
| 4 | Chạy `npm test` (22/22 PASS) | ☐ |
| 5 | Trình duyệt Chrome đã cấp quyền Camera cho localhost:5173 | ☐ |
| 6 | 3 file ảnh chân dung sẵn sàng trên Desktop | ☐ |
| 7 | Video demo `demo_faceid_kiosk.mp4` sẵn sàng trên Desktop | ☐ |
| 8 | Slide thuyết trình phần Face ID (5-7 phút) đã hoàn thiện | ☐ |

---

## Gợi ý câu hỏi phản biện & câu trả lời mẫu

### Q1: "Tại sao chọn ngưỡng 0.55 mà không phải 0.50 hay 0.60?"
> Ngưỡng 0.55 là kết quả thực nghiệm đo đạc trên 200 lượt quét với 5 đối tượng trong 4 điều kiện. Ở 0.50 tỷ lệ từ chối sai lên đến 7.5%, ở 0.60 bắt đầu xuất hiện nhận nhầm người (FAR = 3%). Ngưỡng 0.55 cho Accuracy 98.67% với FAR = 0%.

### Q2: "Nếu giảng viên đeo khẩu trang thì sao?"
> Khẩu trang che phần lớn khuôn mặt (mũi, miệng, cằm) khiến model không trích xuất đủ 68 landmark → hệ thống sẽ báo "Không tìm thấy khuôn mặt". Đây là hành vi đúng vì Face ID yêu cầu xác minh danh tính rõ ràng.

### Q3: "Vector 128 số lưu trong DB có an toàn không?"
> Trường `faceDescriptor` được đặt `select: false` trong Mongoose schema, nghĩa là mọi API lấy danh sách user thông thường sẽ không bao giờ trả về vector này. Chỉ khi API Kiosk cần so khớp thì backend mới truy vấn `User.find().select('+faceDescriptor')`.

### Q4: "Kiosk xác thực bằng gì nếu không có JWT token?"
> Kiosk sử dụng header `x-kiosk-key` với mã bí mật cấu hình trong `.env`. Middleware `verifyKioskKey` kiểm tra header này TRƯỚC middleware JWT. Thêm rate limit 15 request/phút/IP để chống tấn công brute-force.
