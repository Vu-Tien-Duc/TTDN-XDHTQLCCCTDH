# He Thong Quan Ly Cham Cong Can Bo, Giang Vien Truong Dai Hoc

> De tai: Xay dung he thong quan ly cham cong can bo, giang vien truong dai hoc  
> Repository: https://github.com/Vu-Tien-Duc/TTDN-XDHTQLCCCTDH

## Tong Quan

Day la he thong quan ly cham cong, lich giang day, don nghi phep va bao cao thong ke cho moi truong truong dai hoc. Project gom backend Node.js/Express, MongoDB va frontend React/Vite/TypeScript.

He thong hien co cac nhom chuc nang chinh:

| Phan he | Mo ta ngan |
| --- | --- |
| Xac thuc va phien dang nhap | Dang nhap JWT, refresh token, logout, quen mat khau bang OTP email, route guard frontend |
| Phan quyen RBAC | 4 vai tro: `admin`, `truongkhoa`, `giangvien`, `nhanvien` |
| Co cau to chuc | Quan ly Truong, Khoa, Bo mon, Phong ban theo cay phong ban |
| Quan ly can bo | Tao, xem, sua, khoa tai khoan; loc theo vai tro, phong ban, tu khoa |
| Ca lam viec | Cau hinh ca sang, chieu, toi, hanh chinh; nguong di tre/ve som |
| Lich giang day va cong tac | Quan ly lich theo ngay/thu, ca, phong, nguoi duoc phan cong; chan trung lich |
| Cham cong | Check-in/check-out, lich su cham cong, cap nhat thu cong boi admin, cron tu dong danh vang |
| Don nghi phep | Tao don, upload minh chung, theo doi don ca nhan, duyet/tu choi theo phan quyen |
| Bao cao thong ke | Tong hop cham cong, bao cao thang, bieu do, xuat Excel, in PDF |
| Tro ly AI | Chat hoi dap ve du lieu he thong bang Gemini API hoac fallback analytics |
| Audit log | Ghi nhan cac thao tac nhay cam phuc vu truy vet |

Tai lieu chi tiet cac chuc nang hien co nam tai [FEATURES.md](./FEATURES.md).

## Cong Nghe Su Dung

### Backend

| Thanh phan | Cong nghe |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js 5 |
| Database | MongoDB, Mongoose |
| Xac thuc | JWT, refresh token, bcryptjs, cookie-parser |
| Bao mat | Helmet, CORS, rate limiter dang nhap |
| Upload | Multer |
| Email | Nodemailer |
| Cron | node-cron |
| Tai lieu API | Swagger UI Express |

### Frontend

| Thanh phan | Cong nghe |
| --- | --- |
| Framework | React 19 |
| Build tool | Vite |
| Ngon ngu | TypeScript |
| Routing | React Router DOM |
| UI | TailwindCSS, lucide-react, react-hot-toast |
| Form/validate | React Hook Form, Zod |
| HTTP client | Axios voi interceptor refresh token |
| Export | SheetJS `xlsx`, print PDF qua trinh duyet |

## Cau Truc Thu Muc

```text
TTDN-XDHTQLCCCTDH/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── db.js
│   │   ├── mailer.js
│   │   ├── swagger.js
│   │   └── swaggerPaths.js
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── ai/
│   │   │   ├── auth/
│   │   │   ├── common/
│   │   │   ├── dashboard/
│   │   │   ├── leave/
│   │   │   └── schedule/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── public/
├── uploads/
├── postman/
├── API_DOCUMENTATION.md
├── FEATURES.md
├── postman_collection.json
└── requests.http
```

## Cai Dat Va Chay Project

### Yeu cau

- Node.js 20+
- MongoDB local hoac MongoDB Atlas
- npm

### Cai dependencies

```bash
npm install
npm install --prefix frontend
```

### Cau hinh bien moi truong

Tao file `.env` tu `.env.example` va cap nhat cac bien can thiet:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/university_attendance_db
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key_here
CLIENT_URL=http://localhost:5173

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_google_app_password

GEMINI_API_KEY=your_gemini_api_key_optional
```

Neu chua cau hinh email, he thong van co che do dev fallback va in OTP trong terminal cho mot so luong lien quan OTP.

### Seed du lieu mau

```bash
npm run seed
```

Seed tao du lieu mau gom co cau to chuc, tai khoan demo, ca lam viec, lich giang day, don nghi phep, cham cong va audit log mau.

### Chay development

Terminal backend:

```bash
npm run dev
```

Terminal frontend:

```bash
npm run dev --prefix frontend
```

Mac dinh:

- Backend API: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/api-docs`
- Frontend dev: `http://localhost:5173`

### Build production

```bash
npm run build
npm start
```

Sau khi build, Express co the serve SPA trong `frontend/dist` cung API tren cong backend.

## Scripts

| Lenh | Mo ta |
| --- | --- |
| `npm run dev` | Chay backend bang nodemon |
| `npm start` | Chay backend production |
| `npm run seed` | Khoi tao du lieu mau MongoDB |
| `npm run build` | Build frontend |
| `npm run build --prefix frontend` | Typecheck va build frontend |
| `npm run lint --prefix frontend` | Chay oxlint frontend |

Ghi chu: `npm test` hien chua co test suite that, script mac dinh se bao `no test specified`.

## Tai Khoan Demo

Tat ca tai khoan seed mac dinh co mat khau `password123`.

| Vai tro | Email |
| --- | --- |
| Admin | `daihocdtd@gmail.com` |
| Admin | `admin.hr@university.edu.vn` |
| Truong khoa | `truongkhoa.cntt@university.edu.vn` |
| Truong khoa | `truongkhoa.kinhte@university.edu.vn` |
| Giang vien | `giangvien.bich@university.edu.vn` |
| Giang vien | `giangvien.cuong@university.edu.vn` |
| Giang vien | `giangvien.linh@university.edu.vn` |
| Giang vien | `giangvien.an@university.edu.vn` |
| Nhan vien | `nhanvien.ha@university.edu.vn` |
| Nhan vien | `nhanvien.thanh@university.edu.vn` |

Frontend co menu chuyen nhanh tai khoan demo trong header de phuc vu trinh bay va kiem thu.

## Phan Quyen Hien Tai

| Chuc nang | Admin | Truong khoa | Giang vien | Nhan vien |
| --- | --- | --- | --- | --- |
| Dashboard | Co | Co | Co | Co |
| Quan ly co cau to chuc | Co | Khong | Khong | Khong |
| Quan ly can bo | Co | Xem/sua trong khoa | Khong | Khong |
| Bo nhiem user thanh admin | Khong qua man hinh quan ly can bo | Khong | Khong | Khong |
| Quan ly ca lam viec | Co | Khong | Khong | Khong |
| Xem lich | Toan truong | Theo khoa | Ca nhan | Ca nhan |
| Tao/sua/xoa lich | Co | Trong pham vi khoa | Khong | Khong |
| Cham cong | Co | Co | Co | Co |
| Xem bao cao tong hop | Co | Co | Qua API theo pham vi ca nhan | Qua API theo pham vi ca nhan |
| Man hinh bao cao chi tiet | Co | Co | Khong | Khong |
| Tao don nghi phep ca nhan tren frontend | Khong | Co | Co | Co |
| Xem don nghi cua toi tren frontend | Khong | Co | Co | Co |
| Duyet/tu choi don nghi | Co | Trong pham vi khoa | Khong | Khong |
| Tro ly AI | Co | Co | Co | Co |
| Audit log | Co | Khong | Khong | Khong |

Luu y bao mat:

- Route frontend dung `ProtectedRoute allowedRoles` de chan truy cap truc tiep bang URL.
- Backend van kiem tra role bang `verifyToken`, `verifyRole` hoac `authorizeRoles`.
- API quan ly user khong cho tao user role `admin` va khong cho promote user thuong thanh `admin`.
- He thong khong cho tu dang ky cong khai qua `/auth/register`; tai khoan duoc cap boi admin.

## API Tong Quan

Tat ca API chinh nam duoi prefix `/api`.

| Nhom | Prefix | Endpoint chinh | Quyen |
| --- | --- | --- | --- |
| Health | `/health` | `GET /` | Public |
| Auth | `/auth` | `POST /login`, `POST /forgot-password`, `POST /reset-password`, `POST /refresh`, `POST /logout`, `GET /me` | Tuy endpoint |
| Users | `/users` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | Admin, Truong khoa |
| Departments | `/departments` | `GET /`, `GET /tree`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` | Token, CRUD gioi han theo role |
| Shifts | `/shifts`, `/shift-configs` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` | Token, CRUD admin |
| Schedules | `/schedules` | `GET /`, `GET /today`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` | Token, ghi admin/truong khoa |
| Attendance | `/attendance` | `POST /check-in`, `POST /check-out`, `GET /history`, `GET /:id`, `PUT /:id` | Token, override admin |
| Leave | `/leave-requests` | `POST /`, `GET /`, `GET /balance`, `GET /:id`, `PUT /:id/approve`, `PUT /:id/reject` | Token, duyet admin/truong khoa |
| Reports | `/reports` | `GET /attendance`, `GET /monthly` | Token, monthly admin/truong khoa |
| AI | `/ai` | `POST /chat` | Token |
| Audit | `/audit-logs` | `GET /` | Admin |
| Upload | `/upload` | `POST /` | Token |

Tai lieu API day du co the xem tai:

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Swagger UI: `http://localhost:5000/api-docs`
- [postman_collection.json](./postman_collection.json)
- [requests.http](./requests.http)

## Trang Frontend

| Route | Trang | Vai tro |
| --- | --- | --- |
| `/login` | Dang nhap | Public |
| `/dashboard` | Dashboard tong quan | Tat ca role |
| `/departments` | Co cau to chuc | Admin |
| `/users` | Quan ly can bo | Admin, truong khoa |
| `/shifts` | Danh muc ca day/ca lam viec | Admin |
| `/schedules` | Lich giang day va cong tac | Tat ca role |
| `/leave/create` | Tao don nghi | Truong khoa, giang vien, nhan vien |
| `/leave/my-requests` | Don nghi cua toi | Truong khoa, giang vien, nhan vien |
| `/leave/approvals` | Hop duyet don | Admin, truong khoa |
| `/reports` | Bao cao thong ke chi tiet | Admin, truong khoa |
| `/ai-assistant` | Tro ly AI | Tat ca role |
| `/audit-logs` | Nhat ky kiem toan | Admin |

## Collection MongoDB

| Collection | Model |
| --- | --- |
| `users` | Tai khoan nguoi dung |
| `departments` | Don vi to chuc |
| `shift_configs` | Cau hinh ca lam viec |
| `schedules` | Lich giang day/cong tac |
| `attendance_logs` | Log cham cong |
| `leave_requests` | Don nghi phep |
| `audit_logs` | Nhat ky kiem toan |
| `refresh_tokens` | Refresh token |
| `token_blacklists` | Access token da logout |

## Kiem Tra Nhanh Truoc Khi Nghiem Thu

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
node --check src/server.js
node --check src/controllers/user.controller.js
```

Mot so warning lint hien co lien quan toi React compiler/purity va `setState` trong effect; build frontend van pass sau khi cac loi TypeScript unused da duoc xu ly.

## Ghi Chu Trien Khai

- Port backend mac dinh nen dung `PORT=5000`.
- MongoDB local mac dinh: `mongodb://localhost:27017/university_attendance_db`.
- Neu dung production, can cau hinh `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, email SMTP va `GEMINI_API_KEY` that.
- Thu muc `uploads/` luu file minh chung/dinh kem duoc upload.
- Frontend production duoc build vao `frontend/dist/`.
