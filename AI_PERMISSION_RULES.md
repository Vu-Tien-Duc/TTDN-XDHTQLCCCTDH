# 🔒 AI Permission Rules: Ma Trận Phân Quyền 4 Cấp (RBAC)

## 1. Nguyên Tắc Bảo Mật Bắt Buộc (Mục VI & XVIII)
1. **Kiểm soát quyền tại Backend**: LLM tuyệt đối không được tự quyết định quyền xem dữ liệu. Mọi truy vấn đều phải đi qua các hàm kiểm soát quyền `checkUserPermission` và `checkDepartmentPermission` trước khi chạm vào MongoDB.
2. **Không tin cậy Client**: Backend luôn lấy danh tính người dùng từ `req.user` (được giải mã từ JWT token hợp lệ). Mọi tham số `userId` hay `role` gửi từ client đều bị bỏ qua.
3. **Từ chối lịch sự, dứt khoát**: Khi người dùng hỏi vượt quyền, hệ thống trả về thông báo từ chối lịch sự, nêu rõ lý do bảo mật và tuyệt đối không làm lộ số liệu của người khác.

---

## 2. Ma Trận Phân Quyền Chi Tiết (RBAC Matrix)

| Vai trò người dùng (`role`) | Tra cứu chính mình (`self`) | Tra cứu cán bộ/giảng viên cùng Khoa | Tra cứu cán bộ/giảng viên ngoài Khoa | Tra cứu thống kê Khoa của mình | Tra cứu thống kê Khoa khác | Thống kê toàn trường |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`giangvien`** | ✅ Cho phép | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối |
| **`nhanvien`** | ✅ Cho phép | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối | ❌ Từ chối |
| **`truongkhoa`** | ✅ Cho phép | ✅ Cho phép | ❌ Từ chối | ✅ Cho phép | ❌ Từ chối | ❌ Từ chối |
| **`admin`** | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép |

---

## 3. Quy Tắc Áp Dụng Cho Từng Nhóm Câu Hỏi

### 3.1. Nhóm Giảng Viên & Nhân Viên (`giangvien`, `nhanvien`)
- **Được phép hỏi:**
  - *"Hôm nay lịch giảng dạy của tôi như thế nào?"*
  - *"Ngày mai tôi có tiết dạy nào?"*
  - *"Tuần này tôi đi trễ bao nhiêu lần?"*
  - *"Tháng này tôi vắng bao nhiêu ngày?"*
  - *"Đơn xin nghỉ của tôi đang trạng thái gì?"*
- **Bị từ chối:**
  - *"TS. Trần Thị Bích tháng này đi trễ bao nhiêu ngày?"* (Nếu người hỏi không phải là cô Bích)
    -> Trả về: `Bạn chỉ có quyền tra cứu thông tin của chính mình, không có quyền xem thông tin của cán bộ/giảng viên khác.`
  - *"Hôm nay có bao nhiêu người đi làm?"* hoặc *"Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?"*
    -> Trả về: `Bạn không có quyền xem thống kê cấp khoa hoặc toàn hệ thống. Bạn chỉ có thể tra cứu thông tin cá nhân.`

### 3.2. Nhóm Trưởng Khoa (`truongkhoa`)
- **Phạm vi quản lý:** Được mở rộng cho toàn bộ khoa trực thuộc và các bộ môn con (dựa trên cây phân cấp `Department.parentId`).
- **Được phép hỏi:**
  - *"Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?"* (Nếu là Trưởng khoa CNTT)
  - *"Trong tháng này khoa CNTT có bao nhiêu lượt đi trễ?"*
  - *"Trần Thị Bích tuần này dạy bao nhiêu buổi?"* (Nếu cô Bích thuộc khoa CNTT)
  - *"Có bao nhiêu đơn nghỉ đang chờ duyệt?"* (Chỉ thống kê đơn của nhân sự thuộc khoa)
- **Bị từ chối:**
  - *"Trong tháng này khoa Kinh tế có bao nhiêu lượt vắng?"*
    -> Trả về: `Bạn chỉ có quyền tra cứu thống kê thuộc khoa hoặc bộ môn trực thuộc quản lý của mình.`
  - *"Hôm nay toàn trường có bao nhiêu người đi làm?"*
    -> Trả về: `Chỉ Quản trị viên (Admin) mới có quyền xem số liệu chấm công toàn hệ thống.`

### 3.3. Nhóm Quản Trị Viên (`admin`)
- Toàn quyền truy cập mọi câu hỏi cá nhân, cấp khoa và toàn trường.
