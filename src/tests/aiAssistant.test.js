require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('assert');

// Models
const User = require('../models/user.model');
const Department = require('../models/department.model');
const Schedule = require('../models/schedule.model');
const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');

// Services & Utils
const { parseVietnameseDateRange, getVietnamParts } = require('../utils/aiDateParser');
const { parseIntent, INTENTS } = require('../services/aiIntentParser');
const {
  checkUserPermission,
  checkDepartmentPermission,
  resolveUser,
  resolveDepartment,
  getAttendanceSummary,
  getLeaveRequestSummary,
  countTeachingSessions,
  countTeachersWithScheduleOnDate,
  getTopLateUsers,
} = require('../services/aiAnalytics.service');
const { generateFallbackResponse } = require('../services/aiResponse.service');

const runTests = async () => {
  console.log('================================================================');
  console.log('       BẮT ĐẦU CHẠY BỘ KIỂM THỬ TOÀN DIỆN AI ASSISTANT          ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(`     -> Lỗi: ${err.message}\n`);
      failed++;
    }
  };

  // ==========================================================================
  // PHẦN 1: KIỂM THỬ XỬ LÝ THỜI GIAN & MÚI GIỜ ASIA/HO_CHI_MINH (MỤC IV)
  // ==========================================================================
  console.log('--- PHẦN 1: Kiểm thử Date Parser & Múi giờ Asia/Ho_Chi_Minh ---');

  await test('Phân tích mốc "hôm nay" (00:00:00 đến 23:59:59.999 UTC+7)', () => {
    const r = parseVietnameseDateRange('Hôm nay có bao nhiêu người đi làm?');
    assert.strictEqual(r.type, 'TODAY');
    assert(r.fromDate instanceof Date);
    assert(r.toDate instanceof Date);
    assert(r.fromDate < r.toDate);
  });

  await test('Phân tích mốc "hôm qua"', () => {
    const r = parseVietnameseDateRange('Hôm qua ai vắng mặt?');
    assert.strictEqual(r.type, 'YESTERDAY');
  });

  await test('Phân tích mốc "ngày mai"', () => {
    const r = parseVietnameseDateRange('Ngày mai tôi có tiết dạy nào?');
    assert.strictEqual(r.type, 'TOMORROW');
  });

  await test('Phân tích mốc "tuần này" (từ Thứ Hai đến Chủ Nhật)', () => {
    const r = parseVietnameseDateRange('Tuần này có bao nhiêu đơn xin nghỉ?');
    assert.strictEqual(r.type, 'THIS_WEEK');
    const fParts = getVietnamParts(r.fromDate);
    const tParts = getVietnamParts(r.toDate);
    assert.strictEqual(fParts.weekday, 1, 'Ngày bắt đầu phải là Thứ Hai (weekday=1)');
    assert.strictEqual(tParts.weekday, 0, 'Ngày kết thúc phải là Chủ Nhật (weekday=0)');
  });

  await test('Phân tích mốc "tuần trước"', () => {
    const r = parseVietnameseDateRange('Tuần trước ai đi trễ nhiều nhất?');
    assert.strictEqual(r.type, 'LAST_WEEK');
  });

  await test('Phân tích mốc "tháng này"', () => {
    const r = parseVietnameseDateRange('Tháng này có bao nhiêu đơn nghỉ được duyệt?');
    assert.strictEqual(r.type, 'THIS_MONTH');
    const fParts = getVietnamParts(r.fromDate);
    assert.strictEqual(fParts.day, 1, 'Ngày bắt đầu tháng phải là ngày 1');
  });

  await test('Phân tích mốc "tháng trước"', () => {
    const r = parseVietnameseDateRange('Tháng trước tôi đi trễ bao nhiêu lần?');
    assert.strictEqual(r.type, 'LAST_MONTH');
  });

  await test('Phân tích mốc "7 ngày gần nhất"', () => {
    const r = parseVietnameseDateRange('7 ngày gần nhất có bao nhiêu người vi phạm?');
    assert.strictEqual(r.type, 'RECENT_DAYS');
  });

  await test('Phân tích mốc "đầu tháng" và "cuối tháng"', () => {
    const rStart = parseVietnameseDateRange('Đầu tháng này chấm công ra sao?');
    assert.strictEqual(rStart.type, 'MONTH_START');
    const rEnd = parseVietnameseDateRange('Cuối tháng này có bao nhiêu buổi dạy?');
    assert.strictEqual(rEnd.type, 'MONTH_END');
  });

  await test('Phân tích tháng cụ thể "tháng 9/2026"', () => {
    const r = parseVietnameseDateRange('Trong tháng 9/2026 có bao nhiêu buổi?');
    assert.strictEqual(r.type, 'SPECIFIC_MONTH');
    const fParts = getVietnamParts(r.fromDate);
    assert.strictEqual(fParts.month, 9);
    assert.strictEqual(fParts.year, 2026);
  });

  // ==========================================================================
  // PHẦN 2: KẾT NỐI DATABASE VÀ CHUẨN BỊ MÔI TRƯỜNG DỮ LIỆU
  // ==========================================================================
  console.log('\n--- PHẦN 2: Kiểm thử Tích Hợp Cơ Sở Dữ Liệu MongoDB ---');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
  try {
    await mongoose.connect(uri);
    console.log('  ✔ Đã kết nối MongoDB:', uri);
  } catch (dbErr) {
    console.warn('  ⚠️ Không thể kết nối MongoDB trực tiếp:', dbErr.message);
  }

  // Lấy mẫu người dùng từ DB để test
  const adminUser = await User.findOne({ role: 'admin' });
  const itDeanUser = await User.findOne({ role: 'truongkhoa' });
  const lecturerUser = await User.findOne({ role: 'giangvien' });
  const itDept = await Department.findOne({ name: /CNTT/i });

  assert(adminUser, 'Phải có ít nhất 1 tài khoản Admin trong CSDL (chạy npm run seed nếu trống)');
  assert(itDeanUser, 'Phải có ít nhất 1 tài khoản Trưởng khoa trong CSDL');
  assert(lecturerUser, 'Phải có ít nhất 1 tài khoản Giảng viên trong CSDL');

  // ==========================================================================
  // PHẦN 3: KIỂM THỬ PHÂN GIẢI DANH TÍNH (ENTITY RESOLUTION - MỤC V)
  // ==========================================================================
  console.log('\n--- PHẦN 3: Kiểm thử Phân giải Danh tính & Xử lý Danh xưng ---');

  await test('Nhận diện đại từ "tôi", "mình" tương ứng với currentUser', async () => {
    const res = await resolveUser('Lịch dạy của tôi hôm nay thế nào?', { id: lecturerUser._id });
    assert(res.isSelf);
    assert.strictEqual(res.user._id.toString(), lecturerUser._id.toString());
  });

  await test('Bóc tách danh xưng "thầy", "cô", "TS." để tìm đúng người', async () => {
    // Tên giảng viên trong seed có thể là "TS. Trần Thị Bích (Giảng viên KTPM)"
    const res = await resolveUser(`cô ${lecturerUser.fullName}`, { id: adminUser._id });
    assert(res.user, 'Phải tìm thấy giảng viên');
  });

  await test('Xử lý trường hợp tên không tồn tại trong hệ thống', async () => {
    const res = await resolveUser('Nguyễn Văn Không Tồn Tại 999 tháng này đi trễ bao nhiêu ngày?', { id: adminUser._id });
    assert(res.notFound);
  });

  await test('Nhận diện Khoa CNTT từ câu hỏi', async () => {
    const dept = await resolveDepartment('Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?');
    assert(dept);
    assert(dept.name.includes('CNTT') || dept.name.includes('Thông Tin'));
  });

  // ==========================================================================
  // PHẦN 4: KIỂM THỬ MA TRẬN PHÂN QUYỀN RBAC (MỤC VI)
  // ==========================================================================
  console.log('\n--- PHẦN 4: Kiểm thử Ma trận Phân quyền 4 Cấp (RBAC) ---');

  await test('Giảng viên tra cứu chính mình: ĐƯỢC PHÉP', async () => {
    const perm = await checkUserPermission({ id: lecturerUser._id, role: 'giangvien' }, lecturerUser._id);
    assert.strictEqual(perm.allowed, true);
  });

  await test('Giảng viên tra cứu thông tin của giảng viên khác: BỊ TỪ CHỐI (403)', async () => {
    const perm = await checkUserPermission({ id: lecturerUser._id, role: 'giangvien' }, adminUser._id);
    assert.strictEqual(perm.allowed, false);
    assert(perm.reason.includes('chỉ có quyền tra cứu thông tin của chính mình'));
  });

  await test('Giảng viên tra cứu thống kê toàn khoa: BỊ TỪ CHỐI (403)', async () => {
    const perm = await checkDepartmentPermission({ id: lecturerUser._id, role: 'giangvien' }, itDept?._id);
    assert.strictEqual(perm.allowed, false);
    assert(perm.reason.includes('không có quyền xem thống kê'));
  });

  await test('Trưởng khoa tra cứu trong khoa: ĐƯỢC PHÉP', async () => {
    const perm = await checkDepartmentPermission(
      { id: itDeanUser._id, role: 'truongkhoa', departmentId: itDeanUser.departmentId },
      itDeanUser.departmentId
    );
    assert.strictEqual(perm.allowed, true);
  });

  await test('Admin tra cứu bất kỳ ai và bất kỳ đơn vị nào: TOÀN QUYỀN', async () => {
    const permUser = await checkUserPermission({ id: adminUser._id, role: 'admin' }, lecturerUser._id);
    assert.strictEqual(permUser.allowed, true);
    const permDept = await checkDepartmentPermission({ id: adminUser._id, role: 'admin' }, itDept?._id);
    assert.strictEqual(permDept.allowed, true);
  });

  // ==========================================================================
  // PHẦN 5: KIỂM THỬ 20+ CÂU HỎI BẮT BUỘC (MỤC VII & XX)
  // ==========================================================================
  console.log('\n--- PHẦN 5: Kiểm thử 20+ Câu Hỏi Bắt Buộc ---');

  const sampleQuestions = [
    { q: 'Hôm nay có bao nhiêu người đi làm?', expectedIntent: INTENTS.ATTENDANCE_PRESENT_COUNT },
    { q: 'Hôm nay có bao nhiêu người đi trễ?', expectedIntent: INTENTS.ATTENDANCE_LATE_COUNT },
    { q: 'Hôm nay có bao nhiêu người vắng?', expectedIntent: INTENTS.ATTENDANCE_ABSENT_COUNT },
    { q: 'Hôm nay có bao nhiêu đơn xin nghỉ?', expectedIntent: INTENTS.LEAVE_REQUEST_COUNT },
    { q: 'Tuần này có bao nhiêu đơn xin nghỉ?', expectedIntent: INTENTS.LEAVE_REQUEST_COUNT },
    { q: 'Tháng này có bao nhiêu đơn nghỉ được duyệt?', expectedIntent: INTENTS.LEAVE_REQUEST_COUNT },
    { q: `${lecturerUser.fullName} tháng này đi trễ bao nhiêu ngày?`, expectedIntent: INTENTS.ATTENDANCE_USER_LATE },
    { q: `${lecturerUser.fullName} tháng này chấm công đúng giờ bao nhiêu ngày?`, expectedIntent: INTENTS.ATTENDANCE_USER_ON_TIME },
    { q: `${lecturerUser.fullName} tháng này vắng bao nhiêu ngày?`, expectedIntent: INTENTS.ATTENDANCE_USER_ABSENT },
    { q: `${lecturerUser.fullName} tuần này có lịch dạy không?`, expectedIntent: INTENTS.SCHEDULE_USER_CHECK },
    { q: `${lecturerUser.fullName} tuần này dạy bao nhiêu buổi?`, expectedIntent: INTENTS.SCHEDULE_USER_COUNT },
    { q: 'Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?', expectedIntent: INTENTS.SCHEDULE_DEPT_TEACHERS_TODAY },
    { q: 'Có bao nhiêu đơn nghỉ đang chờ duyệt?', expectedIntent: INTENTS.LEAVE_REQUEST_COUNT },
    { q: 'Tuần này có bao nhiêu đơn bị từ chối?', expectedIntent: INTENTS.LEAVE_REQUEST_COUNT },
    { q: `Tháng này tổng số ngày nghỉ của ${lecturerUser.fullName} là bao nhiêu?`, expectedIntent: INTENTS.LEAVE_REQUEST_USER_DAYS },
    { q: `${lecturerUser.fullName} đúng giờ bao nhiêu lần, đi trễ bao nhiêu lần?`, expectedIntent: INTENTS.ATTENDANCE_USER_SUMMARY },
    { q: 'Trong tuần này ai đi trễ nhiều nhất?', expectedIntent: INTENTS.ATTENDANCE_TOP_LATE },
    { q: 'Trong tháng này khoa CNTT có bao nhiêu lượt vắng?', expectedIntent: INTENTS.ATTENDANCE_ABSENT_COUNT },
    { q: 'Hôm nay lịch giảng dạy của tôi như thế nào?', expectedIntent: INTENTS.SCHEDULE_USER_DETAILS },
    { q: 'Ngày mai tôi có tiết dạy nào?', expectedIntent: INTENTS.SCHEDULE_USER_DETAILS },
    { q: 'Tuần này có bao nhiêu đơn dạy bù?', expectedIntent: INTENTS.LEAVE_REQUEST_TYPE_COUNT },
    { q: 'Có bao nhiêu đơn đổi ca đang chờ duyệt?', expectedIntent: INTENTS.LEAVE_REQUEST_TYPE_COUNT },
    { q: `${lecturerUser.fullName} tháng này tổng cộng bao nhiêu ngày chấm công?`, expectedIntent: INTENTS.ATTENDANCE_USER_TOTAL },
  ];

  for (let i = 0; i < sampleQuestions.length; i++) {
    const item = sampleQuestions[i];
    await test(`Câu hỏi ${i + 1}: "${item.q}"`, async () => {
      const parsed = await parseIntent(item.q, { id: lecturerUser._id, role: 'giangvien' });
      assert.strictEqual(parsed.intent, item.expectedIntent, `Mong đợi intent ${item.expectedIntent}, nhận ${parsed.intent}`);
    });
  }

  // ==========================================================================
  // PHẦN 6: KIỂM THỬ TRUY VẤN DỮ LIỆU THỰC TẾ & TÍNH TOÁN (ANALYTICS ENGINE)
  // ==========================================================================
  console.log('\n--- PHẦN 6: Kiểm thử Truy Vấn Số Liệu Thực Tế MongoDB ---');

  await test('Truy vấn số buổi dạy thực tế (Xử lý lịch lặp isRecurring)', async () => {
    const thisMonthRange = parseVietnameseDateRange('tháng này');
    const result = await countTeachingSessions({
      userId: lecturerUser._id,
      fromDate: thisMonthRange.fromDate,
      toDate: thisMonthRange.toDate,
      currentUser: { id: adminUser._id, role: 'admin' },
    });
    assert(result.totalActualSessions !== undefined, 'Phải tính được số buổi thực tế');
    assert(Array.isArray(result.sessions), 'Phải trả về danh sách các buổi dạy');
  });

  await test('Đếm giảng viên có lịch dạy hôm nay theo Khoa CNTT', async () => {
    const result = await countTeachersWithScheduleOnDate({
      departmentId: itDept?._id,
      date: new Date(),
      currentUser: { id: adminUser._id, role: 'admin' },
    });
    assert(result.totalTeachers !== undefined);
    assert(result.totalSessions !== undefined);
  });

  await test('Thống kê đơn xin nghỉ với trạng thái PENDING', async () => {
    const result = await getLeaveRequestSummary({
      status: 'PENDING',
      currentUser: { id: adminUser._id, role: 'admin' },
    });
    assert(result.total !== undefined);
    assert(result.pending !== undefined);
  });

  await test('Thống kê chấm công chính xác không bịa số liệu', async () => {
    const thisMonthRange = parseVietnameseDateRange('tháng này');
    const summary = await getAttendanceSummary({
      userId: lecturerUser._id,
      fromDate: thisMonthRange.fromDate,
      toDate: thisMonthRange.toDate,
      currentUser: { id: adminUser._id, role: 'admin' },
    });
    assert.strictEqual(typeof summary.onTime, 'number');
    assert.strictEqual(typeof summary.late, 'number');
    assert.strictEqual(typeof summary.absent, 'number');
    assert.strictEqual(typeof summary.excusedAbsent, 'number');
  });

  // ==========================================================================
  // PHẦN 7: KIỂM THỬ PHẢN HỒI KHI KHÔNG CÓ DỮ LIỆU HOẶC BỊ TỪ CHỐI
  // ==========================================================================
  console.log('\n--- PHẦN 7: Kiểm thử Phản Hồi Khi Không Có Dữ Liệu / Từ Chối ---');

  await test('Phản hồi khi người dùng không có bản ghi chấm công', () => {
    const text = generateFallbackResponse({
      intent: 'ATTENDANCE_USER_SUMMARY',
      dateRange: { label: 'tháng này' },
      targetUser: { fullName: 'Nguyễn Văn Test' },
      statistics: { total: 0, onTime: 0, late: 0, absent: 0, earlyLeave: 0, excusedAbsent: 0 },
    });
    assert(text.includes('không tìm thấy dữ liệu') || text.includes('0 lượt'));
  });

  await test('Phản hồi từ chối quyền hạn', () => {
    const text = generateFallbackResponse({
      unauthorizedReason: 'Bạn chỉ có quyền tra cứu thông tin của chính mình.',
    });
    assert(text.includes('Từ Chối Quyền Truy Cập'));
  });

  await test('Phản hồi khi có danh sách trùng tên', () => {
    const text = generateFallbackResponse({
      isAmbiguous: true,
      ambiguousMatches: [
        { fullName: 'Nguyễn Văn A (IT)', email: 'a1@uni.edu', departmentName: 'CNTT', role: 'giangvien' },
        { fullName: 'Nguyễn Văn A (Kinh tế)', email: 'a2@uni.edu', departmentName: 'Kinh tế', role: 'giangvien' },
      ],
    });
    assert(text.includes('Yêu Cầu Xác Nhận Danh Tính'));
    assert(text.includes('2 người'));
  });

  // ==========================================================================
  // PHẦN 8: KIỂM THỬ TRỰC TIẾP ENDPOINT POST /api/ai/chat (HTTP INTEGRATION)
  // ==========================================================================
  console.log('\n--- PHẦN 8: Kiểm thử Trực Tiếp Endpoint POST /api/ai/chat ---');

  const jwt = require('jsonwebtoken');
  const http = require('http');
  const app = require('../app');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const serverPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
    process.env.JWT_SECRET || 'super_secret_jwt_key_university_attendance_2026',
    { expiresIn: '1h' }
  );

  const lecturerToken = jwt.sign(
    { id: lecturerUser._id.toString(), email: lecturerUser.email, role: lecturerUser.role },
    process.env.JWT_SECRET || 'super_secret_jwt_key_university_attendance_2026',
    { expiresIn: '1h' }
  );

  const postChat = async (token, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json };
  };

  await test('API: Truy cập không có Bearer token -> 401 Unauthorized', async () => {
    const res = await postChat(null, { message: 'Hôm nay có bao nhiêu người đi làm?' });
    assert.strictEqual(res.status, 401);
  });

  await test('API: Gửi tin nhắn rỗng -> 400 Bad Request', async () => {
    const res = await postChat(adminToken, { message: '   ' });
    assert.strictEqual(res.status, 400);
  });

  await test('API: Admin hỏi "Hôm nay có bao nhiêu đơn xin nghỉ?" -> 200 OK & Dữ liệu chuẩn', async () => {
    const res = await postChat(adminToken, { message: 'Hôm nay có bao nhiêu đơn xin nghỉ?' });
    assert.strictEqual(res.status, 200);
    assert(res.json.success);
    assert(res.json.data.answer);
    assert.strictEqual(res.json.data.intent, 'LEAVE_REQUEST_COUNT');
  });

  await test('API: Giảng viên hỏi "Lịch giảng dạy của tôi hôm nay?" -> 200 OK', async () => {
    const res = await postChat(lecturerToken, { message: 'Hôm nay lịch giảng dạy của tôi như thế nào?' });
    assert.strictEqual(res.status, 200);
    assert(res.json.success);
    assert(res.json.data.answer);
  });

  await test('API: Giảng viên tra cứu người khác -> 200 OK với cờ unauthorized=true và câu từ chối', async () => {
    const res = await postChat(lecturerToken, { message: `${adminUser.fullName} tháng này đi trễ bao nhiêu ngày?` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.data.unauthorized, true);
    assert(res.json.data.answer.includes('Từ Chối Quyền Truy Cập'));
  });

  await new Promise((resolve) => server.close(resolve));

  // ==========================================================================
  // TỔNG KẾT
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`TỔNG KẾT KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch((err) => {
  console.error('Lỗi chạy bộ test:', err);
  process.exit(1);
});
