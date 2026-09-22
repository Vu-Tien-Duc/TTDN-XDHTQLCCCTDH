require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const KIOSK_SECRET = process.env.KIOSK_KEY || 'kiosk_secret_key_university_2026';

let adminToken = '';
let lecturerToken = '';
let lecturerId = '';
let sampleDescriptor = [];

// Helper tạo vector 128 chiều chuẩn hóa L2
function generateNormalizedDescriptor(seed) {
  const vec = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const x = Math.sin(seed * 997 + i * 13.37) * Math.cos(seed * 31.7 + i * 7.11);
    vec.push(x);
    sumSq += x * x;
  }
  const norm = Math.sqrt(sumSq);
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

// Helper thêm nhiễu nhẹ mô phỏng biến thiên góc mặt / ánh sáng (khoảng cách Euclidean < 0.35)
function addNoiseToDescriptor(vec, noiseScale = 0.02) {
  let sumSq = 0;
  const noisy = vec.map((v, i) => {
    const n = Math.sin(i * 7.77) * noiseScale;
    const val = v + n;
    sumSq += val * val;
    return val;
  });
  const norm = Math.sqrt(sumSq);
  return noisy.map((v) => Number((v / norm).toFixed(6)));
}

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Kiểm thử thất bại tại: ${message}`);
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (WEEKS 1-3 & FACE ID KIOSK)');
  console.log(`Target Server: ${BASE_URL}`);
  console.log('========================================================================\n');

  let server = null;
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    const testPing = await fetch(`${BASE_URL}/health`).catch(() => null);
    if (!testPing || testPing.status !== 200) {
      console.log('🔄 Đang tự động khởi động máy chủ API Express (Port 5000)...');
      server = app.listen(5000);
      await new Promise((r) => setTimeout(r, 1200));
    }
  } catch (e) {
    // Ignore ping error
  }

  try {
    // -------------------------------------------------------------------------
    // TC01: Kiểm tra trạng thái máy chủ (Health Check)
    // -------------------------------------------------------------------------
    console.log('[NHÓM 1: HỆ THỐNG & XÁC THỰC NGƯỜI DÙNG]');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'TC01: Health check máy chủ trả về status 200 OK');
    assert(healthData.status === 'OK', 'TC01: Dữ liệu Health check hợp lệ');

    // -------------------------------------------------------------------------
    // TC02: Đăng nhập tài khoản Admin
    // -------------------------------------------------------------------------
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'daihocdtd@gmail.com', password: 'password123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'TC02: Đăng nhập tài khoản Admin IT thành công (200 OK)');
    adminToken = adminLoginData.data?.accessToken || adminLoginData.data?.token;
    assert(!!adminToken, 'TC02: Nhận JWT Access Token của Admin');

    // -------------------------------------------------------------------------
    // TC03: Đăng nhập tài khoản Giảng viên
    // -------------------------------------------------------------------------
    const lecLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'giangvien.bich@university.edu.vn', password: 'password123' }),
    });
    const lecLoginData = await lecLoginRes.json();
    assert(lecLoginRes.status === 200, 'TC03: Đăng nhập tài khoản Giảng viên thành công (200 OK)');
    lecturerToken = lecLoginData.data?.accessToken || lecLoginData.data?.token;
    lecturerId = lecLoginData.data?.user?.id || lecLoginData.data?.user?._id;
    assert(!!lecturerToken && !!lecturerId, 'TC03: Nhận JWT Access Token và ID của Giảng viên');

    // -------------------------------------------------------------------------
    // TC04: Admin đăng ký Vector khuôn mặt 128 chiều thành công
    // -------------------------------------------------------------------------
    console.log('\n[NHÓM 2: BACKEND FACE ID VECTOR REGISTRATION]');
    sampleDescriptor = generateNormalizedDescriptor(888); // Sinh vector chuẩn
    const regRes = await fetch(`${BASE_URL}/users/${lecturerId}/face-descriptor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ faceDescriptor: sampleDescriptor }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 200, 'TC04: Admin đăng ký vector khuôn mặt 128 số thành công (200 OK)');
    assert(regData.data?.faceRegistered === true, 'TC04: Cờ faceRegistered cập nhật thành true');

    // -------------------------------------------------------------------------
    // TC05: Validate Face Descriptor không đủ 128 phần tử -> Báo lỗi 400
    // -------------------------------------------------------------------------
    const shortDescriptor = sampleDescriptor.slice(0, 64);
    const shortRes = await fetch(`${BASE_URL}/users/${lecturerId}/face-descriptor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ faceDescriptor: shortDescriptor }),
    });
    assert(shortRes.status === 400, 'TC05: Từ chối vector không đủ 128 phần tử (400 Bad Request)');

    // -------------------------------------------------------------------------
    // TC06: Validate Face Descriptor chứa phần tử không phải số thực -> Báo lỗi 400
    // -------------------------------------------------------------------------
    const invalidDescriptor = [...sampleDescriptor];
    invalidDescriptor[0] = 'invalid_string';
    const invalidRes = await fetch(`${BASE_URL}/users/${lecturerId}/face-descriptor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ faceDescriptor: invalidDescriptor }),
    });
    assert(invalidRes.status === 400, 'TC06: Từ chối vector chứa phần tử không hợp lệ (400 Bad Request)');

    // -------------------------------------------------------------------------
    // TC07: Giảng viên tự ý gọi API đăng ký khuôn mặt -> Bị chặn 403 Forbidden
    // -------------------------------------------------------------------------
    const nonAdminRes = await fetch(`${BASE_URL}/users/${lecturerId}/face-descriptor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecturerToken}`,
      },
      body: JSON.stringify({ faceDescriptor: sampleDescriptor }),
    });
    assert(nonAdminRes.status === 403, 'TC07: Phân quyền RBAC chặn người dùng non-admin đăng ký khuôn mặt (403 Forbidden)');

    // -------------------------------------------------------------------------
    // TC07b: Chống đăng ký trùng lặp khuôn mặt giữa các tài khoản -> Báo lỗi 409 Conflict
    // -------------------------------------------------------------------------
    const usersListRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersListData = await usersListRes.json();
    const otherUser = usersListData.data?.find((u) => (u._id || u.id) !== lecturerId);
    if (otherUser) {
      const otherId = otherUser._id || otherUser.id;
      const dupRes = await fetch(`${BASE_URL}/users/${otherId}/face-descriptor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ faceDescriptor: sampleDescriptor }),
      });
      const dupData = await dupRes.json();
      assert(dupRes.status === 409, 'TC07b: Chặn đăng ký trùng khuôn mặt với tài khoản khác (409 Conflict)');
      assert(dupData.errorCode === 'USER_003', 'TC07b: Trả về mã lỗi chuẩn USER_003 (USER_FACE_ALREADY_REGISTERED)');
      assert(!!dupData.errors?.duplicateFullName, 'TC07b: Trả về thông tin người sở hữu khuôn mặt bị trùng');
    }

    // -------------------------------------------------------------------------
    // TC08: Kiosk điểm danh không truyền Header x-kiosk-key -> Chặn 401 Unauthorized
    // -------------------------------------------------------------------------
    console.log('\n[NHÓM 3: KIOSK ATTENDANCE & EUCLIDEAN MATCHING]');
    const noKeyRes = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceDescriptor: sampleDescriptor }),
    });
    assert(noKeyRes.status === 401, 'TC08: Kiosk thiếu x-kiosk-key bị từ chối truy cập (401 Unauthorized)');

    // -------------------------------------------------------------------------
    // TC09: Kiosk điểm danh truyền sai x-kiosk-key -> Chặn 403 Forbidden
    // -------------------------------------------------------------------------
    const wrongKeyRes = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-key': 'wrong_secret_key_123',
      },
      body: JSON.stringify({ faceDescriptor: sampleDescriptor }),
    });
    assert(wrongKeyRes.status === 403, 'TC09: Kiosk sai x-kiosk-key bị từ chối truy cập (403 Forbidden)');

    // -------------------------------------------------------------------------
    // TC10: Kiosk điểm danh với Vector trùng khớp khuôn mặt đăng ký (< 0.55)
    // -------------------------------------------------------------------------
    // Xóa log cũ nếu có trong ca hôm nay và đảm bảo có ca/lịch dạy hiệu lực tại thời điểm test
    const AttendanceLog = require('./src/models/attendanceLog.model');
    const ShiftConfig = require('./src/models/shiftConfig.model');
    const Schedule = require('./src/models/schedule.model');
    await AttendanceLog.deleteMany({ userId: lecturerId });

    const todayWeekday = new Date().getDay();
    let allDayShift = await ShiftConfig.findOne({ name: 'Ca Test Toàn Ngày' });
    if (!allDayShift) {
      allDayShift = await ShiftConfig.create({
        name: 'Ca Test Toàn Ngày',
        startTime: '00:00',
        endTime: '23:59',
        lateThresholdMinutes: 1440,
        isActive: true,
      });
    } else {
      allDayShift.startTime = '00:00';
      allDayShift.endTime = '23:59';
      allDayShift.lateThresholdMinutes = 1440;
      await allDayShift.save();
    }
    await Schedule.deleteMany({ userId: lecturerId, weekday: todayWeekday });
    await Schedule.create({
      userId: lecturerId,
      shiftId: allDayShift._id,
      weekday: todayWeekday,
      startTime: '00:00',
      endTime: '23:59',
      isRecurring: true,
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2027, 11, 31),
    });

    // Tạo vector quét thực tế có độ rung nhẹ (nhiễu góc nhìn)
    const liveCaptureDescriptor = addNoiseToDescriptor(sampleDescriptor, 0.02);
    const matchRes = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-key': KIOSK_SECRET,
      },
      body: JSON.stringify({ faceDescriptor: liveCaptureDescriptor }),
    });
    const matchData = await matchRes.json();
    assert(matchRes.status === 200 || matchRes.status === 201, `TC10: Điểm danh Kiosk thành công khi khuôn mặt khớp (Status ${matchRes.status})`);
    assert(matchData.data?.distance < 0.55, `TC10: Khoảng cách Euclidean < 0.55 (Đo được: ${matchData.data?.distance})`);
    assert(matchData.data?.confidenceScore >= 0.70, `TC10: Điểm tin cậy Confidence Score cao (Đạt: ${(matchData.data?.confidenceScore * 100).toFixed(1)}%)`);
    assert(matchData.data?.user?.email === 'giangvien.bich@university.edu.vn', 'TC10: Nhận diện chính xác Giảng viên Bích');

    // -------------------------------------------------------------------------
    // TC11: Điểm danh lặp lại trong cùng ca -> Chống duplicate check-in (409 Conflict)
    // -------------------------------------------------------------------------
    const dupRes = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-key': KIOSK_SECRET,
      },
      body: JSON.stringify({ faceDescriptor: liveCaptureDescriptor }),
    });
    assert(dupRes.status === 409, 'TC11: Chống điểm danh trùng lặp trong cùng ca làm việc (409 Conflict)');

    // -------------------------------------------------------------------------
    // TC12: Kiosk quét khuôn mặt người lạ (Không khớp ai trong DB, d > 0.55) -> Báo lỗi 404
    // -------------------------------------------------------------------------
    const strangerDescriptor = generateNormalizedDescriptor(9999);
    const strangerRes = await fetch(`${BASE_URL}/attendance/face-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-key': KIOSK_SECRET,
      },
      body: JSON.stringify({ faceDescriptor: strangerDescriptor }),
    });
    assert(strangerRes.status === 404, 'TC12: Từ chối khuôn mặt lạ không khớp với bất kỳ nhân sự nào (404 Not Found)');

    // -------------------------------------------------------------------------
    // TC13: Xem lịch sử chấm công lọc theo method=face
    // -------------------------------------------------------------------------
    console.log('\n[NHÓM 4: LỊCH SỬ CHẤM CÔNG ĐA PHƯƠNG THỨC]');
    const historyRes = await fetch(`${BASE_URL}/attendance/history?method=face`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'TC13: Lấy lịch sử chấm công Face ID thành công (200 OK)');
    const logs = historyData.data?.records || historyData.data?.logs || historyData.data || [];
    assert(logs.length > 0, 'TC13: Danh sách chứa bản ghi điểm danh Face ID vừa thực hiện');
    assert(logs[0].method === 'face', 'TC13: Phương thức chấm công ghi nhận chính xác method = face');

    // -------------------------------------------------------------------------
    // TC14: Xóa Face ID thử nghiệm, đảm bảo CSDL chỉ lưu khuôn mặt thật khi người dùng quét
    // -------------------------------------------------------------------------
    console.log('\n[NHÓM 5: DỌN DẸP DỮ LIỆU & BẢO ĐẢM KHUÔN MẶT THỰC]');
    const deleteFaceRes = await fetch(`${BASE_URL}/users/${lecturerId}/face-descriptor`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteFaceData = await deleteFaceRes.json();
    assert(deleteFaceRes.status === 200, 'TC14: Admin xóa Face ID thành công (200 OK)');
    assert(deleteFaceData.data?.faceRegistered === false, 'TC14: Cờ faceRegistered chuyển về false, CSDL hoàn toàn sạch');

    // -------------------------------------------------------------------------
    // NHÓM 6: KIỂM THỬ TRỢ LÝ AI ASSISTANT (PHẦN C - GIAI ĐOẠN 2)
    // -------------------------------------------------------------------------
    console.log('\n[NHÓM 6: TRỢ LÝ AI ASSISTANT END-TO-END & PHÂN QUYỀN RBAC]');

    // TC15: Admin hỏi "Hôm nay có bao nhiêu đơn xin nghỉ?" và "Tuần này có bao nhiêu đơn xin nghỉ?"
    const aiAdminLeaveTodayRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ message: 'Hôm nay có bao nhiêu đơn xin nghỉ?' }),
    });
    const aiAdminLeaveTodayData = await aiAdminLeaveTodayRes.json();
    assert(aiAdminLeaveTodayRes.status === 200, 'TC15: Admin hỏi đơn nghỉ hôm nay -> 200 OK');
    assert(aiAdminLeaveTodayData.success === true, 'TC15: Phản hồi AI thành công');
    assert(Boolean(aiAdminLeaveTodayData.data?.answer), 'TC15: AI trả lời câu hỏi hôm nay có nội dung hợp lệ');

    const aiAdminLeaveWeekRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ message: 'Tuần này có bao nhiêu đơn xin nghỉ?' }),
    });
    const aiAdminLeaveWeekData = await aiAdminLeaveWeekRes.json();
    assert(aiAdminLeaveWeekRes.status === 200, 'TC16: Admin hỏi đơn nghỉ tuần này -> 200 OK');
    assert(aiAdminLeaveWeekData.data?.intent === 'LEAVE_REQUEST_COUNT', 'TC16: Nhận diện chính xác Intent LEAVE_REQUEST_COUNT');

    // TC17: Admin tra cứu chấm công nhân sự theo tên "tháng này đi trễ bao nhiêu ngày?" và "tháng này đúng giờ bao nhiêu ngày?"
    const aiLateRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ message: 'TS. Trần Thị Bích (Giảng viên KTPM) tháng này đi trễ bao nhiêu ngày?' }),
    });
    const aiLateData = await aiLateRes.json();
    assert(aiLateRes.status === 200, 'TC17: Admin tra cứu số ngày đi trễ của nhân sự -> 200 OK');
    assert(aiLateData.data?.intent === 'ATTENDANCE_USER_LATE', 'TC17: Nhận diện chính xác Intent ATTENDANCE_USER_LATE');

    const aiOnTimeRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ message: 'TS. Trần Thị Bích (Giảng viên KTPM) tháng này đúng giờ bao nhiêu ngày?' }),
    });
    const aiOnTimeData = await aiOnTimeRes.json();
    assert(aiOnTimeRes.status === 200, 'TC18: Admin tra cứu số ngày đúng giờ của nhân sự -> 200 OK');
    assert(aiOnTimeData.data?.intent === 'ATTENDANCE_USER_ON_TIME', 'TC18: Nhận diện chính xác Intent ATTENDANCE_USER_ON_TIME');

    // TC19: Tra cứu người dùng không tồn tại trong hệ thống
    const aiNotFoundRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ message: 'Người Không Hề Tồn Tại tháng này đi trễ bao nhiêu ngày?' }),
    });
    const aiNotFoundData = await aiNotFoundRes.json();
    assert(aiNotFoundRes.status === 200, 'TC19: Tra cứu người dùng không tồn tại -> 200 OK phản hồi an toàn');
    assert(Boolean(aiNotFoundData.data?.answer), 'TC19: AI phản hồi thông báo không tìm thấy người dùng một cách chuẩn mực');

    // TC20: Giảng viên hỏi lịch dạy cá nhân "Hôm nay tôi có lịch giảng dạy không?" và "Tuần này tôi có bao nhiêu buổi dạy?"
    const aiLecturerTodayRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecturerToken}`,
      },
      body: JSON.stringify({ message: 'Hôm nay tôi có lịch giảng dạy không?' }),
    });
    const aiLecturerTodayData = await aiLecturerTodayRes.json();
    assert(aiLecturerTodayRes.status === 200, 'TC20: Giảng viên hỏi lịch dạy hôm nay của bản thân -> 200 OK');
    assert(aiLecturerTodayData.data?.intent === 'SCHEDULE_USER_CHECK', 'TC20: Nhận diện chính xác Intent SCHEDULE_USER_CHECK');

    const aiLecturerWeekRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecturerToken}`,
      },
      body: JSON.stringify({ message: 'Tuần này tôi có bao nhiêu buổi dạy?' }),
    });
    const aiLecturerWeekData = await aiLecturerWeekRes.json();
    assert(aiLecturerWeekRes.status === 200, 'TC21: Giảng viên hỏi số buổi dạy trong tuần -> 200 OK');
    assert(aiLecturerWeekData.data?.intent === 'SCHEDULE_USER_COUNT', 'TC21: Nhận diện chính xác Intent SCHEDULE_USER_COUNT');

    // TC22: Giảng viên tra cứu số liệu người khác -> RBAC từ chối (unauthorized: true)
    const aiUnauthorizedRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lecturerToken}`,
      },
      body: JSON.stringify({ message: 'ThS. Phạm Văn Cường (Giảng viên HTTT) tháng này đi trễ bao nhiêu ngày?' }),
    });
    const aiUnauthorizedData = await aiUnauthorizedRes.json();
    assert(aiUnauthorizedRes.status === 200, 'TC22: Giảng viên tra cứu người khác -> AI xử lý trả về 200 OK');
    assert(aiUnauthorizedData.data?.unauthorized === true, 'TC22: Hệ thống RBAC chặn thành công (unauthorized = true), không làm lộ dữ liệu cá nhân');

    // -------------------------------------------------------------------------
    // KẾT LUẬN
    // -------------------------------------------------------------------------
    if (server) {
      await new Promise((r) => server.close(r)).catch(() => {});
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('\n========================================================================');
    console.log(`🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ ĐẠT 100% PASS! (${passedCount}/${totalCount} TEST CASES)`);
    console.log('========================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 DỪNG KIỂM THỬ DO GẶP LỖI:', err.message);
    if (server) {
      await new Promise((r) => server.close(r)).catch(() => {});
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runTests();
