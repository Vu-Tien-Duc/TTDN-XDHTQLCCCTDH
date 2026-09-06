require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import 8 models chuẩn
const User = require('../models/user.model');
const Department = require('../models/department.model');
const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const AuditLog = require('../models/auditLog.model');
const RefreshToken = require('../models/refreshToken.model');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
    await mongoose.connect(uri);
    console.log(`[Database] Đã kết nối MongoDB thành công: ${uri}`);
  } catch (error) {
    console.error(`[Lỗi kết nối MongoDB] ${error.message}`);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    await connectDB();

    console.log('\n--- 1. BẮT ĐẦU XÓA COLLECTIONS VÀ INDEX CŨ ---');
    // Drop các collection cũ để xóa sạch các index lỗi thời (như code_1, userCode_1)
    const collections = [
      'users',
      'departments',
      'shift_configs',
      'schedules',
      'attendance_logs',
      'leave_requests',
      'audit_logs',
      'refresh_tokens',
      'attendances',
      'devices',
      'locations',
      'faceprofiles',
    ];

    for (const col of collections) {
      try {
        await mongoose.connection.collection(col).drop();
      } catch (err) {
        // Bỏ qua nếu collection chưa tồn tại
      }
    }

    // Đồng bộ lại các index mới chuẩn của 8 models
    await Promise.all([
      User.syncIndexes(),
      Department.syncIndexes(),
      ShiftConfig.syncIndexes(),
      Schedule.syncIndexes(),
      AttendanceLog.syncIndexes(),
      LeaveRequest.syncIndexes(),
      AuditLog.syncIndexes(),
      RefreshToken.syncIndexes(),
    ]);

    console.log('✔ Đã làm sạch toàn bộ dữ liệu và đồng bộ lại Indexes chuẩn!');

    console.log('\n--- 2. TẠO CƠ CẤU TỔ CHỨC (DEPARTMENTS) ---');
    // Cấp 1: Trường
    const rootDept = await Department.create({
      name: 'Trường Đại học Công Nghệ & Khoa Học',
      type: 'phongban',
      parentId: null,
      location: { lat: 21.028511, lng: 105.854167 },
    });

    // Cấp 2: Khoa & Phòng ban
    const itFaculty = await Department.create({
      name: 'Khoa Công Nghệ Thông Tin',
      type: 'khoa',
      parentId: rootDept._id,
      location: { lat: 21.028612, lng: 105.854278 },
    });

    const econFaculty = await Department.create({
      name: 'Khoa Kinh Tế & Quản Lý',
      type: 'khoa',
      parentId: rootDept._id,
      location: { lat: 21.028713, lng: 105.854389 },
    });

    const trainingDept = await Department.create({
      name: 'Phòng Đào Tạo & Quản Lý Sinh Viên',
      type: 'phongban',
      parentId: rootDept._id,
      location: { lat: 21.028814, lng: 105.854499 },
    });

    // Cấp 3: Bộ môn
    const seDept = await Department.create({
      name: 'Bộ môn Kỹ Thuật Phần Mềm',
      type: 'bomon',
      parentId: itFaculty._id,
      location: { lat: 21.028615, lng: 105.85428 },
    });

    const isDept = await Department.create({
      name: 'Bộ môn Hệ Thống Thông Tin',
      type: 'bomon',
      parentId: itFaculty._id,
      location: { lat: 21.028618, lng: 105.854285 },
    });
    console.log('✔ Đã tạo 6 đơn vị tổ chức (Trường > Khoa > Bộ môn / Phòng ban).');

    console.log('\n--- 3. TẠO TÀI KHOẢN NGƯỜI DÙNG (USERS) ---');
    // Mật khẩu chung mã hóa bcrypt cost 12
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 1 Admin
    const adminUser = await User.create({
      fullName: 'Quản Trị Viên Hệ Thống (Admin)',
      email: 'admin@university.edu.vn',
      passwordHash,
      role: 'admin',
      departmentId: rootDept._id,
      annualLeaveQuota: 15,
      isActive: true,
    });

    // 1 Trưởng khoa
    const deanUser = await User.create({
      fullName: 'PGS. TS. Lê Hoàng Nam (Trưởng Khoa CNTT)',
      email: 'truongkhoa.cntt@university.edu.vn',
      passwordHash,
      role: 'truongkhoa',
      departmentId: itFaculty._id,
      annualLeaveQuota: 14,
      isActive: true,
    });

    // Cập nhật managerId cho Khoa CNTT
    itFaculty.managerId = deanUser._id;
    await itFaculty.save();

    // 3 Giảng viên
    const lecturerBich = await User.create({
      fullName: 'TS. Trần Thị Bích (Giảng viên KTPM)',
      email: 'giangvien.bich@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: seDept._id,
      annualLeaveQuota: 12,
      isActive: true,
    });

    const lecturerCuong = await User.create({
      fullName: 'ThS. Phạm Văn Cường (Giảng viên HTTT)',
      email: 'giangvien.cuong@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: isDept._id,
      annualLeaveQuota: 12,
      isActive: true,
    });

    const lecturerLinh = await User.create({
      fullName: 'ThS. Hoàng Diệu Linh (Giảng viên CNTT)',
      email: 'giangvien.linh@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: itFaculty._id,
      annualLeaveQuota: 12,
      isActive: true,
    });

    // 1 Nhân viên
    const staffHa = await User.create({
      fullName: 'Đỗ Thu Hà (Chuyên viên Phòng Đào tạo)',
      email: 'nhanvien.ha@university.edu.vn',
      passwordHash,
      role: 'nhanvien',
      departmentId: trainingDept._id,
      annualLeaveQuota: 12,
      isActive: true,
    });
    console.log('✔ Đã tạo 6 tài khoản: 1 Admin, 1 Trưởng khoa, 3 Giảng viên, 1 Nhân viên (Mật khẩu: password123)');

    console.log('\n--- 4. TẠO CÁC CA LÀM VIỆC CHUẨN (SHIFT_CONFIGS) ---');
    const shiftMorning = await ShiftConfig.create({
      name: 'Ca Sáng (Tiết 1 - 4)',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
    });

    const shiftAfternoon = await ShiftConfig.create({
      name: 'Ca Chiều (Tiết 5 - 8)',
      startTime: '13:00',
      endTime: '17:30',
      lateThresholdMinutes: 15,
    });

    const shiftEvening = await ShiftConfig.create({
      name: 'Ca Tối (Tiết 9 - 12)',
      startTime: '18:00',
      endTime: '21:30',
      lateThresholdMinutes: 15,
    });

    const shiftOffice = await ShiftConfig.create({
      name: 'Ca Hành Chính (8h - 17h)',
      startTime: '08:00',
      endTime: '17:00',
      lateThresholdMinutes: 15,
    });
    console.log('✔ Đã tạo 4 ca làm việc chuẩn: Sáng, Chiều, Tối, Hành chính.');

    console.log('\n--- 5. TẠO LỊCH GIẢNG DẠY & CÔNG TÁC (SCHEDULES) ---');
    const now = new Date();
    const currentWeekday = now.getDay(); // Thứ hôm nay theo giờ máy chủ
    const semesterStart = new Date(now.getFullYear(), 0, 15); // Khai giảng học kỳ
    const semesterEnd = new Date(now.getFullYear(), 11, 31);  // Kết thúc học kỳ

    // Lịch 1: Giảng viên Bích dạy vào ĐÚNG THỨ CỦA HÔM NAY (để test check-in tức thì)
    const scheduleToday = await Schedule.create({
      userId: lecturerBich._id,
      shiftId: shiftMorning._id,
      roomId: 'Giảng đường A2-301',
      weekday: currentWeekday,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 2: Giảng viên Bích dạy thêm Ca Chiều vào hôm nay
    await Schedule.create({
      userId: lecturerBich._id,
      shiftId: shiftAfternoon._id,
      roomId: 'Giảng đường A2-302',
      weekday: currentWeekday,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 3: Giảng viên Cường dạy Ca Chiều vào Thứ 2 (weekday: 1)
    await Schedule.create({
      userId: lecturerCuong._id,
      shiftId: shiftAfternoon._id,
      roomId: 'Phòng thực hành Lab-01',
      weekday: 1,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 4: Giảng viên Linh dạy Ca Sáng vào Thứ 4 (weekday: 3)
    await Schedule.create({
      userId: lecturerLinh._id,
      shiftId: shiftMorning._id,
      roomId: 'Giảng đường B1-204',
      weekday: 3,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 5: Chuyên viên Hà làm việc hành chính từ Thứ 2 đến Thứ 6
    for (let wd = 1; wd <= 5; wd++) {
      await Schedule.create({
        userId: staffHa._id,
        shiftId: shiftOffice._id,
        roomId: 'Phòng Đào Tạo A1-102',
        weekday: wd,
        isRecurring: true,
        startDate: semesterStart,
        endDate: semesterEnd,
      });
    }
    console.log('✔ Đã tạo lịch giảng dạy học kỳ cho các giảng viên (bao gồm lịch trùng thứ hôm nay để test check-in).');

    console.log('\n--- 6. TẠO ĐƠN NGHỈ PHÉP MẪU (LEAVE_REQUESTS) ---');
    // Đơn 1: Đã duyệt (APPROVED) 3 ngày của GV Bích -> dùng để test API /leave-requests/balance (12 - 3 = 9 ngày còn lại)
    const leaveApproved = await LeaveRequest.create({
      userId: lecturerBich._id,
      type: 'nghi_phep',
      reason: 'Đi công tác hội thảo khoa học quốc tế tại Đà Nẵng',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 3),
      attachmentUrl: 'https://storage.university.edu.vn/attachments/quyet-dinh-hoi-thao.pdf',
      status: 'APPROVED',
      approvedBy: deanUser._id,
    });

    // Đơn 2: Đang chờ duyệt (PENDING) của GV Cường -> dùng để test duyệt hoặc từ chối đơn
    const leavePending = await LeaveRequest.create({
      userId: lecturerCuong._id,
      type: 'nghi_phep',
      reason: 'Xin nghỉ việc gia đình có việc hiếu',
      startDate: new Date(now.getFullYear(), now.getMonth(), 20),
      endDate: new Date(now.getFullYear(), now.getMonth(), 21),
      attachmentUrl: null,
      status: 'PENDING',
    });
    console.log('✔ Đã tạo 2 đơn nghỉ phép mẫu: 1 đơn APPROVED (3 ngày) và 1 đơn PENDING.');

    console.log('\n--- 7. TẠO BẢN GHI CHẤM CÔNG MẪU (ATTENDANCE_LOGS) ---');
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(7, 5, 0, 0);

    const yesterdayOut = new Date(yesterday);
    yesterdayOut.setHours(11, 30, 0, 0);

    await AttendanceLog.create({
      userId: lecturerBich._id,
      shiftId: shiftMorning._id,
      scheduleId: scheduleToday._id,
      checkInTime: yesterday,
      checkOutTime: yesterdayOut,
      method: 'qr',
      isManualOverride: false,
      status: 'ON_TIME',
      location: { lat: 21.028511, lng: 105.854167 },
      deviceId: 'KIOSK_A2_GATE',
    });
    console.log('✔ Đã tạo bản ghi chấm công mẫu hôm qua.');

    console.log('\n--- 8. TẠO NHẬT KÝ KIỂM TOÁN MẪU (AUDIT_LOGS) ---');
    await AuditLog.create({
      actor: deanUser._id,
      action: 'APPROVE_LEAVE',
      targetId: leaveApproved._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: '127.0.0.1',
      timestamp: new Date(),
    });
    console.log('✔ Đã tạo bản ghi kiểm toán mẫu cho thao tác duyệt đơn của Trưởng Khoa.');

    console.log('\n================================================================');
    console.log('🎉 KHỞI TẠO DỮ LIỆU MẪU (SEED DATA) HOÀN TẤT THÀNH CÔNG!');
    console.log('================================================================');
    console.log('Danh sách tài khoản đăng nhập kiểm thử:');
    console.log('1. Admin:         admin@university.edu.vn            / password123');
    console.log('2. Trưởng Khoa:   truongkhoa.cntt@university.edu.vn  / password123');
    console.log('3. Giảng Viên 1:  giangvien.bich@university.edu.vn   / password123 (Đã duyệt nghỉ 3 ngày)');
    console.log('4. Giảng Viên 2:  giangvien.cuong@university.edu.vn  / password123 (Có đơn PENDING)');
    console.log('5. Giảng Viên 3:  giangvien.linh@university.edu.vn   / password123');
    console.log('6. Nhân Viên:     nhanvien.ha@university.edu.vn      / password123');
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo dữ liệu mẫu:', error);
    process.exit(1);
  }
};

seedData();
