/**
 * TEST_VERIFY_LOGIC_STABILITY.JS
 * Bộ kiểm thử toàn diện kiểm tra tính ổn định của các logic đã sửa và bổ sung:
 * 1. RBAC Xác thực đa vai trò (Admin, Trưởng khoa, Giảng viên, Nhân viên)
 * 2. Vòng đời Đơn nghỉ phép (Tạo đơn, Hạn mức, Chặn tự duyệt, Duyệt đơn -> Đồng bộ EXCUSED_ABSENCE, Từ chối đơn)
 * 3. Báo cáo thống kê tháng MongoDB (WeeklyTrend 4 tuần, Phạm vi Trưởng khoa deanScope chặn xem ngoài khoa)
 * 4. Kiosk Face Check-In (Bảo mật x-kiosk-key, 409 Conflict chống quét trùng lặp)
 * 5. Trợ lý AI Assistant RBAC 4 vai trò (Admin, Trưởng khoa, Giảng viên, Nhân viên, Chặn hỏi người khác)
 * 6. Single-Port Production Static Serving (Phục vụ frontend/dist trên Express port 5000)
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const assert = require('assert');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';
const ROOT_URL = process.env.TEST_ROOT_URL || 'http://localhost:5000';
const KIOSK_SECRET = process.env.KIOSK_KEY || 'kiosk_secret_key_university_2026';

let passed = 0;
let failed = 0;

const runAssert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✔ [PASS] ${message}`);
  passed++;
};

async function ensureServerRunning() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbUri);
    console.log('[Database] Kết nối MongoDB thành công trong tiến trình test');
  }

  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) return null;
  } catch {}

  console.log('🔄 Đang tự động kết nối CSDL và khởi động máy chủ API Express (Port 5000)...');
  const app = require('./src/app');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5000, resolve));
  console.log('[Server] Máy chủ Express đã khởi động trên cổng 5000');
  return server;
}

// Helper tạo vector 128 số thực chuẩn hóa Euclidean L2 = 1.0
function generateNormalizedDescriptor(seed = 1) {
  const vector = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = Math.sin(seed * (i + 1)) * Math.cos(seed + i);
    vector.push(val);
    sumSq += val * val;
  }
  const magnitude = Math.sqrt(sumSq);
  return vector.map((v) => v / magnitude);
}

function addNoiseToDescriptor(vector, noiseLevel = 0.02) {
  const noisy = vector.map((v, i) => v + Math.sin(i * 99) * noiseLevel);
  const sumSq = noisy.reduce((acc, v) => acc + v * v, 0);
  const mag = Math.sqrt(sumSq);
  return noisy.map((v) => v / mag);
}

async function main() {
  let server = null;
  try {
    server = await ensureServerRunning();

    console.log('\n========================================================================');
    console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍNH ỔN ĐỊNH CỦA CÁC LOGIC ĐÃ SỬA / BỔ SUNG');
    console.log('========================================================================\n');

    // -------------------------------------------------------------------------
    // MODULE 1: XÁC THỰC & ĐĂNG NHẬP 4 VAI TRÒ
    // -------------------------------------------------------------------------
    console.log('[PHẦN 1: XÁC THỰC 4 VAI TRÒ (ADMIN, DEAN, LECTURER, STAFF)]');
    
    // 1.1 Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'daihocdtd@gmail.com', password: 'password123' }),
    });
    const adminData = await adminLoginRes.json();
    runAssert(adminLoginRes.status === 200, 'Admin đăng nhập thành công (200 OK)');
    const adminToken = adminData.data?.accessToken || adminData.data?.token;
    const adminUser = adminData.data?.user;

    // 1.2 Dean login (Trưởng khoa CNTT)
    const deanLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'truongkhoa.cntt@university.edu.vn', password: 'password123' }),
    });
    const deanData = await deanLoginRes.json();
    runAssert(deanLoginRes.status === 200, 'Trưởng khoa CNTT đăng nhập thành công (200 OK)');
    const deanToken = deanData.data?.accessToken || deanData.data?.token;
    const deanUser = deanData.data?.user;

    // 1.3 Lecturer login (Giảng viên Bích)
    const lecLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'giangvien.bich@university.edu.vn', password: 'password123' }),
    });
    const lecData = await lecLoginRes.json();
    runAssert(lecLoginRes.status === 200, 'Giảng viên Bích đăng nhập thành công (200 OK)');
    const lecToken = lecData.data?.accessToken || lecData.data?.token;
    const lecUser = lecData.data?.user;

    // 1.4 Staff login (Nhân viên Hà)
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nhanvien.ha@university.edu.vn', password: 'password123' }),
    });
    const staffData = await staffLoginRes.json();
    runAssert(staffLoginRes.status === 200, 'Nhân viên Phòng Đào Tạo đăng nhập thành công (200 OK)');
    const staffToken = staffData.data?.accessToken || staffData.data?.token;
    const staffUser = staffData.data?.user;

    // -------------------------------------------------------------------------
    // MODULE 2: ĐƠN NGHỈ PHÉP & TỰ ĐỘNG ĐỒNG BỘ ĐIỂM DANH (EXCUSED_ABSENCE)
    // -------------------------------------------------------------------------
    console.log('\n[PHẦN 2: VÒNG ĐỜI ĐƠN NGHỈ PHÉP & TỰ ĐỘNG ĐỒNG BỘ EXCUSED_ABSENCE]');

    // 2.1 Giảng viên kiểm tra số dư phép
    const balanceRes = await fetch(`${BASE_URL}/leave-requests/balance`, {
      headers: { Authorization: `Bearer ${lecToken}` },
    });
    const balanceData = await balanceRes.json();
    runAssert(balanceRes.status === 200, 'Giảng viên kiểm tra số dư ngày phép thành công (200 OK)');
    runAssert(balanceData.data?.annualLeaveQuota !== undefined, 'Thông tin hạn mức phép (annualLeaveQuota) tồn tại');

    // 2.2 Dọn dẹp đơn cũ trùng ngày để test sạch sẽ
    const LeaveRequest = require('./src/models/leaveRequest.model');
    const AttendanceLog = require('./src/models/attendanceLog.model');
    const Schedule = require('./src/models/schedule.model');
    const ShiftConfig = require('./src/models/shiftConfig.model');

    const testStartDate = '2026-11-16'; // Thứ Hai
    const testEndDate = '2026-11-16';
    await LeaveRequest.deleteMany({ userId: lecUser._id || lecUser.id, startDate: new Date('2026-11-16T00:00:00.000Z') });
    await AttendanceLog.deleteMany({ userId: lecUser._id || lecUser.id, checkInTime: { $gte: new Date('2026-11-16T00:00:00.000Z'), $lte: new Date('2026-11-16T23:59:59.999Z') } });

    // Tạo sẵn 1 lịch dạy vào Thứ Hai ngày 16/11/2026 cho Giảng viên Bích
    let testShift = await ShiftConfig.findOne({ name: 'Ca Test Sáng Thứ Hai' });
    if (!testShift) {
      testShift = await ShiftConfig.create({
        name: 'Ca Test Sáng Thứ Hai',
        startTime: '08:00',
        endTime: '11:30',
        lateThresholdMinutes: 15,
        isActive: true,
      });
    }
    await Schedule.deleteMany({ userId: lecUser._id || lecUser.id, subjectName: 'Kiểm Thử Phần Mềm' });
    const testSchedule = await Schedule.create({
      userId: lecUser._id || lecUser.id,
      shiftId: testShift._id,
      weekday: 1, // Thứ Hai
      startTime: '08:00',
      endTime: '11:30',
      subjectName: 'Kiểm Thử Phần Mềm',
      subjectCode: 'KTPM301',
      roomId: 'A201',
      isRecurring: true,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
    });

    // 2.3 Giảng viên nộp đơn nghỉ phép
    const createLeaveRes = await fetch(`${BASE_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecToken}`,
      },
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Đi công tác hội thảo khoa học quốc tế IEEE 2026',
        startDate: testStartDate,
        endDate: testEndDate,
      }),
    });
    const createLeaveData = await createLeaveRes.json();
    runAssert(createLeaveRes.status === 201 || createLeaveRes.status === 200, 'Giảng viên gửi đơn xin nghỉ phép thành công (201/200)');
    const leaveId = createLeaveData.data?._id || createLeaveData.data?.id;
    runAssert(!!leaveId, 'Đơn nghỉ được cấp mã định danh ID');

    // 2.4 Bảo mật: Giảng viên tự duyệt đơn của mình -> Phải bị chặn 403
    const selfApproveRes = await fetch(`${BASE_URL}/leave-requests/${leaveId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecToken}`,
      },
      body: JSON.stringify({ approvalNote: 'Tự duyệt đơn của mình' }),
    });
    runAssert(selfApproveRes.status === 403, 'Chặn giảng viên tự duyệt đơn của bản thân (403 Forbidden)');

    // 2.5 Trưởng khoa CNTT phê duyệt đơn của Giảng viên khoa mình
    const deanApproveRes = await fetch(`${BASE_URL}/leave-requests/${leaveId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deanToken}`,
      },
      body: JSON.stringify({ approvalNote: 'Đồng ý cho giảng viên tham dự hội thảo IEEE' }),
    });
    const deanApproveData = await deanApproveRes.json();
    runAssert(deanApproveRes.status === 200, 'Trưởng khoa phê duyệt đơn thành công (200 OK)');
    runAssert(deanApproveData.data?.status === 'APPROVED', 'Trạng thái đơn chuyển sang APPROVED');

    // 2.6 Kiểm tra tự động tạo bản ghi AttendanceLog trạng thái EXCUSED_ABSENCE
    const excusedLog = await AttendanceLog.findOne({
      userId: lecUser._id || lecUser.id,
      leaveRequestId: leaveId,
    });
    runAssert(!!excusedLog, 'Tự động tạo bản ghi AttendanceLog tương ứng với đơn nghỉ');
    runAssert(excusedLog?.status === 'EXCUSED_ABSENCE', 'Bản ghi điểm danh ghi nhận trạng thái EXCUSED_ABSENCE');

    // 2.7 Giảng viên nộp đơn thứ hai để kiểm tra luồng TỪ CHỐI (REJECT)
    const testStartDate2 = '2026-11-23';
    const testEndDate2 = '2026-11-23';
    await LeaveRequest.deleteMany({ userId: lecUser._id || lecUser.id, startDate: new Date('2026-11-23T00:00:00.000Z') });
    const createLeaveRes2 = await fetch(`${BASE_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecToken}`,
      },
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Có việc gia đình đột xuất',
        startDate: testStartDate2,
        endDate: testEndDate2,
      }),
    });
    const createLeaveData2 = await createLeaveRes2.json();
    const leaveId2 = createLeaveData2.data?._id || createLeaveData2.data?.id;

    // Trưởng khoa từ chối đơn
    const deanRejectRes = await fetch(`${BASE_URL}/leave-requests/${leaveId2}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deanToken}`,
      },
      body: JSON.stringify({ rejectionReason: 'Trùng lịch thi kết thúc học phần của lớp' }),
    });
    const deanRejectData = await deanRejectRes.json();
    runAssert(deanRejectRes.status === 200, 'Trưởng khoa từ chối đơn nghỉ phép thành công (200 OK)');
    runAssert(deanRejectData.data?.status === 'REJECTED', 'Trạng thái đơn ghi nhận REJECTED');

    // -------------------------------------------------------------------------
    // MODULE 3: BÁO CÁO THÁNG & WEEKLY TREND (MONGODB DỮ LIỆU THẬT)
    // -------------------------------------------------------------------------
    console.log('\n[PHẦN 3: BÁO CÁO THÁNG MONGODB & WEEKLY TREND & DEANSCOPE]');

    // 3.1 Admin xem báo cáo tháng
    const monthlyRes = await fetch(`${BASE_URL}/reports/monthly?month=9&year=2026`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const monthlyData = await monthlyRes.json();
    runAssert(monthlyRes.status === 200, 'Admin lấy báo cáo tháng 9/2026 thành công (200 OK)');
    runAssert(Array.isArray(monthlyData.data?.weeklyTrend), 'Dữ liệu weeklyTrend trả về dạng mảng 4 tuần');
    runAssert(monthlyData.data?.weeklyTrend.length === 4, 'weeklyTrend tính toán đủ 4 tuần trong tháng từ MongoDB');
    runAssert(typeof monthlyData.data?.weeklyTrend[0].rate === 'number', 'weeklyTrend có chỉ số rate (tỷ lệ đúng giờ) chuẩn số thực');

    // 3.2 Trưởng khoa xem báo cáo (chỉ trong khoa CNTT)
    const deanMonthlyRes = await fetch(`${BASE_URL}/reports/monthly?month=9&year=2026`, {
      headers: { Authorization: `Bearer ${deanToken}` },
    });
    const deanMonthlyData = await deanMonthlyRes.json();
    runAssert(deanMonthlyRes.status === 200, 'Trưởng khoa lấy báo cáo tháng thành công trong khoa mình (200 OK)');

    // 3.3 Trưởng khoa cố tình xem báo cáo phòng ban khác ngoài khoa -> Chặn 403
    const fakeOtherDeptId = new mongoose.Types.ObjectId().toString();
    const deanCrossDeptRes = await fetch(`${BASE_URL}/reports/monthly?month=9&year=2026&departmentId=${fakeOtherDeptId}`, {
      headers: { Authorization: `Bearer ${deanToken}` },
    });
    runAssert(deanCrossDeptRes.status === 403, 'DeanScope: Chặn Trưởng khoa xem báo cáo của phòng ban ngoài khoa (403 Forbidden)');

    // -------------------------------------------------------------------------
    // MODULE 4: KIOSK FACE CHECK-IN & CHỐNG DUPLICATE CHECK-IN (409)
    // -------------------------------------------------------------------------
    console.log('\n[PHẦN 4: KIOSK FACE CHECK-IN & CHỐNG DUPLICATE CHECK-IN (409)]');

    // Đăng ký khuôn mặt cho Giảng viên Bích để test Kiosk
    const faceVector = generateNormalizedDescriptor(777);
    await fetch(`${BASE_URL}/users/${lecUser._id || lecUser.id}/face-descriptor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ faceDescriptor: faceVector }),
    });

    // Tạo ca làm việc và lịch dạy cho ngày hôm nay
    const todayWeekday = new Date().getDay();
    let kioskTodayShift = await ShiftConfig.findOne({ name: 'Ca Test Kiosk Hôm Nay' });
    if (!kioskTodayShift) {
      kioskTodayShift = await ShiftConfig.create({
        name: 'Ca Test Kiosk Hôm Nay',
        startTime: '00:00',
        endTime: '23:59',
        lateThresholdMinutes: 15,
        isActive: true,
      });
    }
    await Schedule.deleteMany({ userId: lecUser._id || lecUser.id, weekday: todayWeekday, subjectName: 'Kiosk Attendance Test' });
    await Schedule.create({
      userId: lecUser._id || lecUser.id,
      shiftId: kioskTodayShift._id,
      weekday: todayWeekday,
      startTime: '00:00',
      endTime: '23:59',
      subjectName: 'Kiosk Attendance Test',
      isRecurring: true,
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2027, 11, 31),
    });
    // Xóa tất cả log điểm danh cũ của Giảng viên Bích để bắt đầu phiên test Kiosk sạch sẽ
    await AttendanceLog.deleteMany({ userId: lecUser._id || lecUser.id });

    // 4.1 Check-in lần 1: Thành công
    const liveVector = addNoiseToDescriptor(faceVector, 0.02);
    const checkin1Res = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-key': KIOSK_SECRET,
      },
      body: JSON.stringify({ faceDescriptor: liveVector }),
    });
    const checkin1Data = await checkin1Res.json();
    runAssert(checkin1Res.status === 200 || checkin1Res.status === 201, 'Kiosk điểm danh khuôn mặt lần 1 thành công (200 OK)');
    runAssert(checkin1Data.data?.action === 'CHECK_IN' || checkin1Data.data?.status === 'OK', 'Ghi nhận hành động CHECK_IN');

    // 4.2 Check-in lần 2 ngay lập tức (double-scan / trùng ca): Phải trả về 409 Conflict
    const checkin2Res = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-key': KIOSK_SECRET,
      },
      body: JSON.stringify({ faceDescriptor: liveVector }),
    });
    runAssert(checkin2Res.status === 409, 'Kiosk chống quét trùng lặp trong ca (trả về đúng chuẩn HTTP 409 Conflict)');

    // -------------------------------------------------------------------------
    // MODULE 5: TRỢ LÝ AI ASSISTANT & MA TRẬN PHÂN QUYỀN 4 VAI TRÒ
    // -------------------------------------------------------------------------
    console.log('\n[PHẦN 5: TRỢ LÝ AI ASSISTANT END-TO-END & RBAC 4 VAI TRÒ]');

    // 5.1 Admin tra cứu tổng hợp toàn trường -> Được phép (200 OK)
    const aiAdminRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ message: 'Hôm nay có bao nhiêu đơn xin nghỉ?' }),
    });
    const aiAdminData = await aiAdminRes.json();
    runAssert(aiAdminRes.status === 200, 'Admin hỏi AI thành công (200 OK)');
    runAssert(aiAdminData.data?.unauthorized === false, 'Admin có toàn quyền tra cứu (unauthorized = false)');

    // 5.2 Trưởng khoa hỏi về khoa mình -> Được phép (200 OK)
    const aiDeanRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deanToken}`,
      },
      body: JSON.stringify({ message: 'Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?' }),
    });
    const aiDeanData = await aiDeanRes.json();
    runAssert(aiDeanRes.status === 200, 'Trưởng khoa hỏi lịch dạy của khoa CNTT thành công (200 OK)');
    runAssert(aiDeanData.data?.unauthorized === false, 'Trưởng khoa được phép tra cứu trong khoa mình (unauthorized = false)');

    // 5.3 Giảng viên hỏi lịch dạy của bản thân -> Được phép (200 OK)
    const aiLecSelfRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecToken}`,
      },
      body: JSON.stringify({ message: 'Lịch giảng dạy của tôi hôm nay như thế nào?' }),
    });
    const aiLecSelfData = await aiLecSelfRes.json();
    runAssert(aiLecSelfRes.status === 200, 'Giảng viên hỏi lịch dạy của bản thân thành công (200 OK)');
    runAssert(aiLecSelfData.data?.unauthorized === false, 'Giảng viên xem dữ liệu chính mình (unauthorized = false)');

    // 5.4 Giảng viên hỏi dữ liệu cá nhân của người khác -> RBAC CHẶN (unauthorized = true)
    const aiLecCrossRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecToken}`,
      },
      body: JSON.stringify({ message: 'ThS. Phạm Văn Cường (Giảng viên HTTT) tháng này đi trễ bao nhiêu ngày?' }),
    });
    const aiLecCrossData = await aiLecCrossRes.json();
    runAssert(aiLecCrossRes.status === 200, 'AI xử lý câu hỏi ngoài thẩm quyền trả về 200 an toàn');
    runAssert(aiLecCrossData.data?.unauthorized === true, 'RBAC chặn Giảng viên xem dữ liệu người khác (unauthorized = true)');

    // 5.5 Nhân viên hỏi số ngày chấm công của bản thân -> Được phép (200 OK)
    const aiStaffSelfRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ message: 'Tháng này tôi chấm công bao nhiêu ngày?' }),
    });
    const aiStaffSelfData = await aiStaffSelfRes.json();
    runAssert(aiStaffSelfRes.status === 200, 'Nhân viên hỏi chấm công của chính mình thành công (200 OK)');
    runAssert(aiStaffSelfData.data?.unauthorized === false, 'Nhân viên xem dữ liệu của mình (unauthorized = false)');

    // -------------------------------------------------------------------------
    // MODULE 6: SINGLE-PORT PRODUCTION SERVING (FRONTEND/DIST)
    // -------------------------------------------------------------------------
    console.log('\n[PHẦN 6: PHỤC VỤ FRONTEND PRODUCTION SINGLE-PORT]');

    const rootRes = await fetch(`${ROOT_URL}/`);
    const rootText = await rootRes.text();
    runAssert(rootRes.status === 200, 'GET / trả về HTTP 200 OK');
    runAssert(rootText.includes('<div id="root"></div>'), 'Giao diện SPA Frontend React/Vite sẵn sàng phục vụ');

    // Dọn dẹp Face vector test của Bích
    await fetch(`${BASE_URL}/users/${lecUser._id || lecUser.id}/face-descriptor`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // -------------------------------------------------------------------------
    // TỔNG KẾT
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`🎉 TẤT CẢ LOGIC HOẠT ĐỘNG ỔN ĐỊNH VÀ CHÍNH XÁC! (${passed} PASS, ${failed} FAIL)`);
    console.log('========================================================================\n');

    if (server) {
      await new Promise((r) => server.close(r)).catch(() => {});
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  } catch (err) {
    console.error('\n💥 KIỂM THỬ GẶP LỖI:', err.message);
    if (server) {
      await new Promise((r) => server.close(r)).catch(() => {});
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

main();
