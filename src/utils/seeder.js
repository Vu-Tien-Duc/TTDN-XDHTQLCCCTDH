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
    const collections = [
      'users',
      'departments',
      'shift_configs',
      'schedules',
      'attendance_logs',
      'leave_requests',
      'audit_logs',
      'refresh_tokens',
      'token_blacklists',
    ];

    for (const col of collections) {
      try {
        await mongoose.connection.collection(col).drop();
      } catch (err) {
        // Bỏ qua nếu collection chưa tồn tại
      }
    }

    // Đồng bộ lại các index mới chuẩn của models
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

    console.log('\n--- 2. TẠO CƠ CẤU TỔ CHỨC THEO CHUẨN ĐẠI HỌC (DEPARTMENTS) ---');
    // =========================================================================
    // CẤP CAO NHẤT: Ban Giám Hiệu (Toàn trường)
    // =========================================================================
    const boardOfPresidents = await Department.create({
      name: 'Ban Giám Hiệu',
      type: 'phongban',
      parentId: null,
      location: { lat: 21.028511, lng: 105.854167 },
    });

    // =========================================================================
    // KHỐI QUẢN LÝ & PHÒNG BAN CHỨC NĂNG (type: phongban, parentId: Ban Giám Hiệu)
    // =========================================================================
    const trainingDept = await Department.create({
      name: 'Phòng Đào Tạo',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028612, lng: 105.854278 },
    });

    const hrDept = await Department.create({
      name: 'Phòng Hành Chính - Tổng Hợp',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028713, lng: 105.854389 },
    });

    const studentAffairsDept = await Department.create({
      name: 'Phòng Công Tác Sinh Viên',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028814, lng: 105.854499 },
    });

    const qaTestingDept = await Department.create({
      name: 'Phòng Khảo Thí & Đảm Bảo Chất Lượng',
      type: 'phongban',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028915, lng: 105.854501 },
    });

    // =========================================================================
    // KHỐI ĐÀO TẠO: KHOA & BỘ MÔN (type: khoa & bomon)
    // =========================================================================

    // 1. Khoa Công Nghệ Thông Tin & Chuyển Đổi Số
    const itFaculty = await Department.create({
      name: 'Khoa Công Nghệ Thông Tin & Chuyển Đổi Số',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028615, lng: 105.85428 },
    });
    const seDept = await Department.create({
      name: 'Bộ Môn Kỹ Thuật Phần Mềm',
      type: 'bomon',
      parentId: itFaculty._id,
      location: { lat: 21.028615, lng: 105.85428 },
    });
    const isDept = await Department.create({
      name: 'Bộ Môn Hệ Thống Thông Tin',
      type: 'bomon',
      parentId: itFaculty._id,
      location: { lat: 21.028618, lng: 105.854285 },
    });

    // 2. Khoa Kinh Tế - Quản Trị Kinh Doanh
    const econFaculty = await Department.create({
      name: 'Khoa Kinh Tế - Quản Trị Kinh Doanh',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.028715, lng: 105.85439 },
    });
    const accDept = await Department.create({
      name: 'Bộ Môn Kế Toán',
      type: 'bomon',
      parentId: econFaculty._id,
      location: { lat: 21.028715, lng: 105.85439 },
    });
    const baDept = await Department.create({
      name: 'Bộ Môn Quản Trị Kinh Doanh',
      type: 'bomon',
      parentId: econFaculty._id,
      location: { lat: 21.028718, lng: 105.854395 },
    });

    // 3. Khoa Ngôn Ngữ và Văn Hóa Hàn Quốc / Nhật Bản
    const langFaculty = await Department.create({
      name: 'Khoa Ngôn Ngữ và Văn Hóa Hàn Quốc / Nhật Bản',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.02882, lng: 105.85445 },
    });
    const koreanDept = await Department.create({
      name: 'Bộ Môn Ngôn Ngữ & Văn Hóa Hàn Quốc',
      type: 'bomon',
      parentId: langFaculty._id,
      location: { lat: 21.02882, lng: 105.85445 },
    });
    const japaneseDept = await Department.create({
      name: 'Bộ Môn Ngôn Ngữ & Văn Hóa Nhật Bản',
      type: 'bomon',
      parentId: langFaculty._id,
      location: { lat: 21.028825, lng: 105.854455 },
    });

    // 4. Khoa Thiết Kế Mỹ Thuật Ứng Dụng
    const designFaculty = await Department.create({
      name: 'Khoa Thiết Kế Mỹ Thuật Ứng Dụng',
      type: 'khoa',
      parentId: boardOfPresidents._id,
      location: { lat: 21.02893, lng: 105.85455 },
    });
    const graphicDept = await Department.create({
      name: 'Bộ Môn Thiết Kế Đồ Họa',
      type: 'bomon',
      parentId: designFaculty._id,
      location: { lat: 21.02893, lng: 105.85455 },
    });
    const archDept = await Department.create({
      name: 'Bộ Môn Kiến Trúc',
      type: 'bomon',
      parentId: designFaculty._id,
      location: { lat: 21.028935, lng: 105.854555 },
    });

    console.log('✔ Đã tạo đầy đủ 14 đơn vị tổ chức:');
    console.log('  - 1 Ban Giám Hiệu');
    console.log('  - 4 Phòng ban chức năng: Đào tạo, Hành chính - Tổng hợp, Công tác sinh viên, Khảo thí & ĐBCL');
    console.log('  - 4 Khoa đào tạo: CNTT & CĐS, Kinh tế - QTKD, Ngôn ngữ Hàn/Nhật, Thiết kế Mỹ thuật ứng dụng');
    console.log('  - 8 Bộ môn chuyên môn trực thuộc 4 Khoa.');

    console.log('\n--- 3. TẠO TÀI KHOẢN NGƯỜI DÙNG ÁNH XẠ CHỨC DANH (USERS) ---');
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // =========================================================================
    // 1. NHÓM ADMIN (Quản trị viên / HR)
    // =========================================================================
    // Admin 1: Chuyên viên IT quản lý server / hệ thống
    const adminUser = await User.create({
      fullName: 'Quản Trị Viên Hệ Thống (Admin IT)',
      email: 'daihocdtd@gmail.com',
      passwordHash,
      role: 'admin',
      departmentId: boardOfPresidents._id,
      annualLeaveQuota: 15,
      isActive: true,
      isVerified: true,
    });

    // Admin 2: Trưởng phòng Hành chính - Tổng hợp (HR quản lý nhân sự & báo cáo)
    const hrManager = await User.create({
      fullName: 'ThS. Nguyễn Thị Mai (Trưởng Phòng HC-TH)',
      email: 'admin.hr@university.edu.vn',
      passwordHash,
      role: 'admin',
      departmentId: hrDept._id,
      annualLeaveQuota: 15,
      isActive: true,
      isVerified: true,
    });
    hrDept.managerId = hrManager._id;
    await hrDept.save();

    // =========================================================================
    // 2. NHÓM TRƯỞNG KHOA (Quản lý cấp trung)
    // =========================================================================
    // Trưởng Khoa CNTT & Chuyển đổi số
    const itDean = await User.create({
      fullName: 'PGS. TS. Lê Hoàng Nam (Trưởng Khoa CNTT & CĐS)',
      email: 'truongkhoa.cntt@university.edu.vn',
      passwordHash,
      role: 'truongkhoa',
      departmentId: itFaculty._id,
      annualLeaveQuota: 14,
      isActive: true,
      isVerified: true,
    });
    itFaculty.managerId = itDean._id;
    await itFaculty.save();

    // Trưởng Khoa Kinh tế - Quản trị kinh doanh
    const econDean = await User.create({
      fullName: 'TS. Phạm Hải Đăng (Trưởng Khoa Kinh Tế - QTKD)',
      email: 'truongkhoa.kinhte@university.edu.vn',
      passwordHash,
      role: 'truongkhoa',
      departmentId: econFaculty._id,
      annualLeaveQuota: 14,
      isActive: true,
      isVerified: true,
    });
    econFaculty.managerId = econDean._id;
    await econFaculty.save();

    // =========================================================================
    // 3. NHÓM GIẢNG VIÊN (Giảng viên cơ hữu & thỉnh giảng - chấm công theo Lịch dạy)
    // =========================================================================
    // GV 1: Giảng viên Bộ môn Kỹ thuật phần mềm (Khoa CNTT)
    const lecturerBich = await User.create({
      fullName: 'TS. Trần Thị Bích (Giảng viên KTPM)',
      email: 'giangvien.bich@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: seDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
    });

    // GV 2: Giảng viên Bộ môn Hệ thống thông tin (Khoa CNTT)
    const lecturerCuong = await User.create({
      fullName: 'ThS. Phạm Văn Cường (Giảng viên HTTT)',
      email: 'giangvien.cuong@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: isDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
    });

    // GV 3: Giảng viên Bộ môn Kế toán (Khoa Kinh tế)
    const lecturerLinh = await User.create({
      fullName: 'ThS. Hoàng Diệu Linh (Giảng viên Kế Toán)',
      email: 'giangvien.linh@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: accDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
    });

    // GV 4: Giảng viên Bộ môn Thiết kế đồ họa (Khoa MTUD)
    const lecturerAn = await User.create({
      fullName: 'ThS. Nguyễn Trọng An (Giảng viên Đồ Họa)',
      email: 'giangvien.an@university.edu.vn',
      passwordHash,
      role: 'giangvien',
      departmentId: graphicDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
    });

    // =========================================================================
    // 4. NHÓM NHÂN VIÊN HÀNH CHÍNH (Chấm công theo ca hành chính cố định)
    // =========================================================================
    // Chuyên viên Phòng Đào tạo (Xếp lịch trình, quản lý thi)
    const staffHa = await User.create({
      fullName: 'Đỗ Thu Hà (Chuyên viên Phòng Đào Tạo)',
      email: 'nhanvien.ha@university.edu.vn',
      passwordHash,
      role: 'nhanvien',
      departmentId: trainingDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
    });

    // Chuyên viên Phòng Khảo thí & Đảm bảo chất lượng
    const staffThanh = await User.create({
      fullName: 'Lê Quang Thành (Chuyên viên Phòng Khảo Thí)',
      email: 'nhanvien.thanh@university.edu.vn',
      passwordHash,
      role: 'nhanvien',
      departmentId: qaTestingDept._id,
      annualLeaveQuota: 12,
      isActive: true,
      isVerified: true,
    });

    console.log('✔ Đã tạo 10 tài khoản người dùng theo đúng 4 nhóm role:');
    console.log('  - 2 Admin: Chuyên viên IT & Trưởng phòng HC-TH');
    console.log('  - 2 Trưởng khoa: Trưởng khoa CNTT & CĐS, Trưởng khoa Kinh tế - QTKD');
    console.log('  - 4 Giảng viên: KTPM, HTTT, Kế toán, Thiết kế đồ họa');
    console.log('  - 2 Nhân viên hành chính: Phòng Đào tạo & Phòng Khảo thí');

    console.log('\n--- 4. TẠO CÁC CA LÀM VIỆC CHUẨN (SHIFT_CONFIGS) ---');
    const shiftMorning = await ShiftConfig.create({
      name: 'Ca Sáng (Tiết 1 - 4)',
      startTime: '07:00',
      endTime: '11:30',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });

    const shiftAfternoon = await ShiftConfig.create({
      name: 'Ca Chiều (Tiết 5 - 8)',
      startTime: '12:30',
      endTime: '17:00',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });

    const shiftEvening = await ShiftConfig.create({
      name: 'Ca Tối (Tiết 9 - 12)',
      startTime: '17:30',
      endTime: '21:00',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });

    const shiftOffice = await ShiftConfig.create({
      name: 'Ca Hành Chính Cố Định (8h - 17h)',
      startTime: '08:00',
      endTime: '17:00',
      lateThresholdMinutes: 15,
      earlyExitThresholdMinutes: 15,
      isActive: true,
    });
    console.log('✔ Đã tạo 4 ca làm việc chuẩn: Sáng (7h-11h30), Chiều (12h30-17h), Tối (17h30-21h), Hành chính (8h-17h).');

    console.log('\n--- 5. TẠO LỊCH GIẢNG DẠY & LỊCH HÀNH CHÍNH (SCHEDULES) ---');
    const now = new Date();
    const currentWeekday = now.getDay(); // Thứ hôm nay theo giờ máy tính
    const semesterStart = new Date(now.getFullYear(), 0, 15);
    const semesterEnd = new Date(now.getFullYear(), 11, 31);

    // Lịch 1: GV Bích dạy Ca Sáng vào đúng thứ của hôm nay (phục vụ test check-in tức thì)
    const scheduleToday = await Schedule.create({
      userId: lecturerBich._id,
      shiftId: shiftMorning._id,
      roomId: 'Giảng đường CNTT A2-301',
      weekday: currentWeekday,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 2: GV Bích dạy thêm Ca Chiều vào hôm nay
    await Schedule.create({
      userId: lecturerBich._id,
      shiftId: shiftAfternoon._id,
      roomId: 'Phòng máy Lab-02',
      weekday: currentWeekday,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 3: GV Cường dạy Ca Chiều vào Thứ 2 (weekday: 1)
    await Schedule.create({
      userId: lecturerCuong._id,
      shiftId: shiftAfternoon._id,
      roomId: 'Phòng máy Lab-01',
      weekday: 1,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 4: GV Linh dạy Ca Sáng vào Thứ 4 (weekday: 3)
    await Schedule.create({
      userId: lecturerLinh._id,
      shiftId: shiftMorning._id,
      roomId: 'Giảng đường Kinh Tế B1-204',
      weekday: 3,
      isRecurring: true,
      startDate: semesterStart,
      endDate: semesterEnd,
    });

    // Lịch 5: Chuyên viên Hà (Phòng Đào tạo) làm việc ca Hành chính từ Thứ 2 đến Thứ 6
    for (let wd = 1; wd <= 5; wd++) {
      await Schedule.create({
        userId: staffHa._id,
        shiftId: shiftOffice._id,
        roomId: 'Văn phòng Phòng Đào Tạo A1-102',
        weekday: wd,
        isRecurring: true,
        startDate: semesterStart,
        endDate: semesterEnd,
      });
    }

    // Lịch 6: Chuyên viên Thành (Phòng Khảo thí) làm việc ca Hành chính từ Thứ 2 đến Thứ 6
    for (let wd = 1; wd <= 5; wd++) {
      await Schedule.create({
        userId: staffThanh._id,
        shiftId: shiftOffice._id,
        roomId: 'Văn phòng Khảo Thí & ĐBCL A1-205',
        weekday: wd,
        isRecurring: true,
        startDate: semesterStart,
        endDate: semesterEnd,
      });
    }
    console.log('✔ Đã phân công lịch giảng dạy cho Giảng viên & Lịch ca hành chính cho Chuyên viên.');

    console.log('\n--- 6. TẠO ĐƠN NGHỈ PHÉP MẪU (LEAVE_REQUESTS) ---');
    // Đơn 1: Đã duyệt (APPROVED) 3 ngày của GV Bích (12 - 3 = 9 ngày còn lại)
    const leaveApproved = await LeaveRequest.create({
      userId: lecturerBich._id,
      type: 'nghi_phep',
      reason: 'Đi công tác hội thảo khoa học quốc tế về Công nghệ phần mềm',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 3),
      attachmentUrl: 'https://storage.university.edu.vn/attachments/quyet-dinh-hoi-thao.pdf',
      status: 'APPROVED',
      approvedBy: itDean._id,
    });

    // Đơn 2: Đang chờ duyệt (PENDING) của GV Cường
    await LeaveRequest.create({
      userId: lecturerCuong._id,
      type: 'nghi_phep',
      reason: 'Xin nghỉ phép việc gia đình có việc hiếu',
      startDate: new Date(now.getFullYear(), now.getMonth(), 20),
      endDate: new Date(now.getFullYear(), now.getMonth(), 21),
      attachmentUrl: null,
      status: 'PENDING',
    });

    // Đơn 2: Đang chờ duyệt (PENDING) của Trưởng khoa Nam (để Admin Ban Giám Hiệu kiểm thử duyệt)
    await LeaveRequest.create({
      userId: itDean._id,
      type: 'nghi_phep',
      reason: 'Trưởng khoa tham gia Hội nghị Hiệp hội CNTT Quốc tế',
      startDate: new Date(now.getFullYear(), now.getMonth(), 25),
      endDate: new Date(now.getFullYear(), now.getMonth(), 27),
      attachmentUrl: null,
      status: 'PENDING',
    });
    console.log('✔ Đã tạo 2 đơn nghỉ phép mẫu PENDING (1 của GV Cường cho Trưởng khoa duyệt, 1 của Trưởng khoa cho Admin duyệt). GV Bích nguyên vẹn 12 ngày phép (0 ngày đã dùng).');

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
    console.log('✔ Đã tạo bản ghi chấm công mẫu hôm qua (ĐÚNG GIỜ).');

    console.log('\n--- 8. TẠO NHẬT KÝ KIỂM TOÁN MẪU (AUDIT_LOGS) ---');
    await AuditLog.create({
      actor: itDean._id,
      action: 'APPROVE_LEAVE',
      targetId: leaveApproved._id.toString(),
      targetType: 'LeaveRequest',
      ipAddress: '127.0.0.1',
      timestamp: new Date(),
      details: {
        reason: 'Trưởng khoa CNTT duyệt đơn nghỉ phép của GV Bích',
      },
    });
    console.log('✔ Đã tạo bản ghi kiểm toán mẫu cho thao tác của Trưởng Khoa.');

    console.log('\n================================================================');
    console.log('🎉 KHỞI TẠO CƠ SỞ DỮ LIỆU CHUẨN ĐẠI HỌC HOÀN TẤT!');
    console.log('================================================================');
    console.log('Danh sách tài khoản đăng nhập mẫu (Mật khẩu chung: password123):');
    console.log('1. Admin IT:          daihocdtd@gmail.com');
    console.log('2. Admin HR:          admin.hr@university.edu.vn');
    console.log('3. Trưởng Khoa CNTT:  truongkhoa.cntt@university.edu.vn');
    console.log('4. Trưởng Khoa KinhTế:truongkhoa.kinhte@university.edu.vn');
    console.log('5. Giảng viên KTPM:   giangvien.bich@university.edu.vn (Quỹ phép còn 9/12)');
    console.log('6. Giảng viên HTTT:   giangvien.cuong@university.edu.vn (Đang có đơn chờ duyệt)');
    console.log('7. Chuyên viên ĐàoTạo:nhanvien.ha@university.edu.vn (Ca hành chính)');
    console.log('8. Chuyên viên KhảoThí:nhanvien.thanh@university.edu.vn (Ca hành chính)');
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo dữ liệu mẫu:', error);
    process.exit(1);
  }
};

seedData();
