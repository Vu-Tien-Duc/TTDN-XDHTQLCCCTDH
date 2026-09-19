# Cac Chuc Nang Hien Co Cua Project

Tai lieu nay tom tat cac chuc nang dang co trong he thong quan ly cham cong can bo, giang vien truong dai hoc. Noi dung duoc tong hop theo code hien tai cua backend va frontend.

## 1. Xac Thuc, Phien Dang Nhap Va Bao Mat

### Dang nhap

- Dang nhap bang email va mat khau.
- Mat khau duoc hash bang `bcryptjs`.
- Backend cap access token JWT va refresh token.
- Refresh token duoc luu trong database va co the gui qua cookie HTTP-only.
- Axios client frontend co interceptor tu dong refresh access token khi het han.

### Quan ly phien

- `POST /api/auth/refresh` cap token moi.
- `POST /api/auth/logout` xoa refresh token va blacklist access token hien tai.
- `GET /api/auth/me` lay lai thong tin nguoi dung dang dang nhap.

### Quen mat khau bang OTP

- `POST /api/auth/forgot-password` tao OTP.
- `POST /api/auth/reset-password` dat lai mat khau bang OTP.
- OTP co thoi han va gioi han so lan nhap sai.
- Neu chua cau hinh SMTP, he thong co fallback in OTP ra terminal trong moi truong dev.

### Dang ky tai khoan

- He thong hien khong mo tu dang ky cong khai qua `/api/auth/register`.
- Tai khoan nguoi dung duoc tao boi admin trong phan he quan ly can bo.

### Bao ve route

- Frontend dung `ProtectedRoute`.
- Backend dung `verifyToken`, `verifyRole`, `authorizeRoles`.
- Cac route bi an tren sidebar van duoc chan bang `allowedRoles`, khong chi an menu.

## 2. Phan Quyen RBAC

He thong co 4 vai tro:

| Vai tro | Mo ta |
| --- | --- |
| `admin` | Quan tri he thong, cau hinh du lieu cap truong, bao cao, audit log |
| `truongkhoa` | Quan ly nhan su, lich, duyet don trong pham vi khoa |
| `giangvien` | Xem lich ca nhan, cham cong, tao va theo doi don nghi |
| `nhanvien` | Xem lich ca nhan, cham cong, tao va theo doi don nghi |

Quy tac dang chu y:

- Admin khong duoc bo nhiem user thuong thanh `admin` qua man hinh quan ly can bo.
- Backend cung chan payload tao user role `admin` va update user thuong thanh `admin`.
- Admin khong co route frontend de tao don nghi ca nhan hoac xem "don nghi cua toi".
- Truong khoa chi thao tac du lieu nhan su/lich/don trong pham vi khoa duoc gan.

## 3. Dashboard Tong Quan

Trang `/dashboard` hien thi tong quan theo vai tro:

- Lich hom nay.
- Nhat ky cham cong gan day.
- Trang thai don nghi.
- Thong ke cham cong theo thang.
- Chi so tong quan cho admin/truong khoa.
- Loi tat nhanh toi lich, cham cong, don nghi, bao cao va tro ly AI.

Dashboard goi du lieu that tu cac service:

- `scheduleService`
- `attendanceService`
- `reportService`
- `leaveService`
- `userService`
- `departmentService`
- `shiftService`

## 4. Co Cau To Chuc

Phan he co cau to chuc gom:

- Xem danh sach phong ban/don vi.
- Xem cay to chuc qua `/api/departments/tree`.
- Tao don vi moi.
- Cap nhat thong tin don vi.
- Xoa don vi.
- Gan nguoi quan ly don vi.
- Luu thong tin vi tri neu co.

Phan quyen:

- Admin co quyen CRUD chinh.
- Truong khoa co mot so quyen cap nhat trong pham vi duoc backend cho phep.
- Cac vai tro khac co the xem danh sach/cay to chuc.

## 5. Quan Ly Can Bo Va Tai Khoan

Trang `/users` phuc vu quan ly can bo/giang vien/nhan vien:

- Xem danh sach user.
- Tim kiem theo ten/email.
- Loc theo vai tro.
- Loc theo phong ban doi voi admin.
- Tao user moi.
- Sua thong tin user.
- Cap nhat han muc phep nam.
- Khoa tai khoan bang soft delete (`isActive = false`).
- Hien thi badge vai tro va trang thai.

Quy tac role:

- Admin co the tao user role `truongkhoa`, `giangvien`, `nhanvien`.
- Admin khong tao moi user role `admin` trong form quan ly can bo.
- Admin khong promote user thuong thanh `admin`.
- Truong khoa chi sua duoc thong tin co ban cua nhan su trong khoa, khong duoc doi role, doi khoa, kich hoat/vo hieu hoa.

Moi thao tac tao/sua/xoa user duoc ghi audit log.

## 6. Danh Muc Ca Lam Viec

Trang `/shifts` va API `/api/shifts` ho tro:

- Xem danh sach ca.
- Xem chi tiet ca.
- Tao ca moi.
- Sua ca.
- Xoa ca.
- Cau hinh gio bat dau, gio ket thuc.
- Cau hinh nguong di tre.
- Cau hinh nguong ve som neu co.
- Bat/tat trang thai ca.

CRUD ca lam viec chi danh cho admin.

## 7. Lich Giang Day Va Cong Tac

Trang `/schedules` va API `/api/schedules` ho tro:

- Xem lich.
- Xem lich hom nay.
- Xem chi tiet lich.
- Tao lich.
- Sua lich.
- Xoa lich.
- Gan nguoi dung, ca, phong, mon hoc, nam hoc, hoc ky.
- Ho tro lich lap theo thu trong tuan.
- Loc lich theo pham vi role.

Phan quyen:

- Admin xem va quan ly lich toan truong.
- Truong khoa quan ly lich trong pham vi khoa.
- Giang vien/nhan vien xem lich ca nhan.

Backend co logic phat hien trung lich de tranh lap lich cung nguoi/cung thoi gian.

## 8. Cham Cong

API `/api/attendance` va cac man hinh lien quan ho tro:

- Check-in.
- Check-out.
- Lay lich su cham cong.
- Xem chi tiet log cham cong.
- Admin cap nhat log cham cong thu cong.
- Ghi nhan trang thai:
  - `ON_TIME`
  - `LATE`
  - `EARLY_LEAVE`
  - `ABSENT`
  - `EXCUSED_ABSENCE`

He thong tinh trang thai dua tren:

- Lich/ca duoc gan.
- Gio check-in.
- Gio check-out.
- Nguong di tre/ve som.
- Don nghi phep da duoc duyet.

## 9. Cron Tu Dong Danh Vang

`cron.service.js` co tac vu nen:

- Chay cuoi ngay theo timezone Viet Nam.
- Quet cac lich dang hieu luc.
- Kiem tra log cham cong trong ngay.
- Tu dong tao log `ABSENT` neu khong cham cong.
- Ghi `EXCUSED_ABSENCE` neu co don nghi phep phu hop da duoc duyet.
- Ghi audit log cho tac vu tu dong.
- Gui email canh bao vang mat neu cau hinh email.

Admin co endpoint kich hoat thu cong:

- `POST /api/attendance/trigger-absent-cron`
- `POST /api/attendance/cron/test-daily-check`

## 10. Don Nghi Phep

Phan he don nghi gom cac trang:

- `/leave/create`: tao don nghi.
- `/leave/my-requests`: xem don cua toi.
- `/leave/approvals`: hop duyet don.

Chuc nang:

- Tao don nghi phep.
- Tao don day bu/doi ca theo kieu du lieu he thong ho tro.
- Upload file minh chung.
- Xem danh sach don.
- Xem chi tiet don.
- Kiem tra quy ngay phep con lai.
- Duyet don.
- Tu choi don kem ly do.
- Gui email thong bao khi don duoc xu ly.

Phan quyen frontend:

- `truongkhoa`, `giangvien`, `nhanvien` duoc tao/xem don ca nhan.
- `admin`, `truongkhoa` duoc vao hop duyet don.
- Admin bi chan khoi cac URL don ca nhan tren frontend.

Phan quyen backend:

- API leave yeu cau token.
- Duyet/tu choi don chi danh cho admin va truong khoa.
- Truong khoa bi gioi han theo pham vi khoa.

## 11. Bao Cao Va Thong Ke

Trang `/reports` danh cho admin va truong khoa:

- Bao cao tong hop cham cong.
- Bao cao chi tiet theo thang.
- Bieu do donut theo trang thai cham cong.
- Bieu do cot theo nhan su.
- Bieu do duong xu huong.
- Xuat Excel.
- In PDF qua trinh duyet.

API bao cao:

- `GET /api/reports/attendance`
- `GET /api/reports/monthly`

Phan quyen:

- Admin xem toan truong.
- Truong khoa xem theo khoa.
- API attendance report co ho tro pham vi ca nhan cho giang vien/nhan vien.
- Monthly report chi danh cho admin/truong khoa.

## 12. Tro Ly AI Thanh Tra

Trang `/ai-assistant` va widget chat noi:

- Cho phep dat cau hoi ve du lieu cham cong, lich, nhan su, vang/tre.
- Neu co `GEMINI_API_KEY`, backend goi Google Gemini `gemini-1.5-flash`.
- Neu khong co key hoac goi Gemini loi, backend dung fallback analytics engine.
- AI endpoint yeu cau dang nhap.

Endpoint:

- `POST /api/ai/chat`

## 13. Audit Log

He thong co collection `audit_logs` de truy vet:

- Tao user.
- Cap nhat user.
- Khoa user.
- Cap nhat cham cong boi admin.
- Cron tu dong danh vang.
- Cac thao tac nhay cam khac trong backend.

Trang `/audit-logs` duoc bao ve cho admin. API:

- `GET /api/audit-logs`

## 14. Upload File

He thong co upload file qua Multer:

- Upload minh chung don nghi.
- Upload mot file qua field `file`.
- Thu muc luu file: `uploads/`.

Endpoint:

- `POST /api/upload`

## 15. Tai Lieu Va Cong Cu Kiem Thu API

Project co san:

- `API_DOCUMENTATION.md`
- Swagger UI tai `/api-docs`
- `postman_collection.json`
- `requests.http`
- Thu muc `postman/`

## 16. Gioi Han Va Viec Can Luu Y

- Project chua co test suite tu dong; `npm test` hien chi bao `no test specified`.
- Frontend lint con mot so warning ve React compiler/purity va setState trong effect.
- Dang ky cong khai dang bi tat, dung chuc nang quan ly can bo de cap tai khoan.
- Tai khoan `admin` nen duoc seed hoac tao bang quy trinh quan tri rieng, khong bo nhiem tu man hinh user thong thuong.
- Can cau hinh secret that truoc khi deploy production.
