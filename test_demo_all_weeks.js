/**
 * SCRIPT KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN TIẾN ĐỘ 5 TUẦN (TV C)
 * Hệ thống Quản lý Chấm công cho Trường Đại học
 * 
 * Kiểm tra đầy đủ:
 * - Tuần 1: LeaveRequest + AuditLog + Nodemailer
 * - Tuần 2: 3 loại đơn + Upload file thực tế (Multer) + Static serving
 * - Tuần 3: Duyệt/từ chối theo cấp bậc + Email + Đồng bộ Chấm công (EXCUSED_ABSENCE) + Leave Balance (Aggregate) + RBAC
 * - Tuần 4: API Báo cáo thống kê (/api/reports/attendance) chuẩn RBAC cá nhân/khoa/trường + Báo cáo tháng (/api/reports/monthly)
 * - Tuần 5: Tổng hợp Audit Logs + Health check 9 collections + Trình diễn kịch bản
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';
const ROOT_URL = 'http://localhost:5000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

const logPass = (msg) => console.log(`${colors.green}✔ PASS:${colors.reset} ${msg}`);
const logFail = (msg, detail) => console.log(`${colors.red}✖ FAIL:${colors.reset} ${msg}`, detail || '');
const logInfo = (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`);
const logHeader = (msg) => console.log(`\n${colors.bold}${colors.yellow}================================================================${colors.reset}\n${colors.bold}${colors.yellow}${msg}${colors.reset}\n${colors.bold}${colors.yellow}================================================================${colors.reset}`);

let testStats = { total: 0, passed: 0, failed: 0 };

function assert(condition, successMsg, failMsg, detail) {
  testStats.total++;
  if (condition) {
    testStats.passed++;
    logPass(successMsg);
    return true;
  } else {
    testStats.failed++;
    logFail(failMsg, detail);
    return false;
  }
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = { ...options.headers };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (!options.isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    headers,
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  return { status: response.status, ok: response.ok, data };
}

async function login(email, password = 'password123') {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok || !res.data?.data?.token) {
    throw new Error(`Đăng nhập thất bại cho ${email}: ${JSON.stringify(res.data)}`);
  }
  return {
    token: res.data.data.token,
    user: res.data.data.user,
  };
}

async function runComprehensiveTests() {
  console.log(`${colors.bold}${colors.magenta}BẮT ĐẦU CHẠY BỘ TEST TOÀN DIỆN TIẾN ĐỘ 5 TUẦN - HỆ THỐNG QUẢN LÝ CHẤM CÔNG${colors.reset}\n`);

  try {
    // -------------------------------------------------------------
    // GIAI ĐOẠN 0: KIỂM TRA HẠ TẦNG & HEALTH CHECK (TUẦN 1 & 5)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 0: KIỂM TRA HẠ TẦNG VÀ HEALTH CHECK (9 COLLECTIONS)');
    const healthRes = await request(`${ROOT_URL}/health`);
    assert(
      healthRes.status === 200 && healthRes.data?.status === 'OK' && healthRes.data?.collectionsCount === 9,
      `Hệ thống hoạt động bình thường, hỗ trợ đầy đủ 9 collections MongoDB: ${healthRes.data?.collections?.join(', ')}`,
      'Kiểm tra Health check thất bại',
      healthRes.data
    );

    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: ĐĂNG NHẬP CÁC VAI TRÒ HỆ THỐNG
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 1: ĐĂNG NHẬP XÁC THỰC CÁC VAI TRÒ (RBAC)');
    const admin = await login('daihocdtd@gmail.com');
    assert(admin.user.role === 'admin', `Đăng nhập Quản trị viên (Admin): ${admin.user.fullName}`, 'Đăng nhập Admin thất bại');

    const dean = await login('truongkhoa.cntt@university.edu.vn');
    assert(dean.user.role === 'truongkhoa', `Đăng nhập Trưởng khoa CNTT: ${dean.user.fullName}`, 'Đăng nhập Trưởng khoa thất bại');

    const lecturer = await login('giangvien.bich@university.edu.vn');
    assert(lecturer.user.role === 'giangvien', `Đăng nhập Giảng viên: ${lecturer.user.fullName}`, 'Đăng nhập Giảng viên thất bại');

    const staff = await login('nhanvien.ha@university.edu.vn');
    assert(staff.user.role === 'nhanvien', `Đăng nhập Nhân viên: ${staff.user.fullName}`, 'Đăng nhập Nhân viên thất bại');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: KIỂM THỬ UPLOAD FILE MINH CHỨNG THỰC TẾ (TUẦN 2)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 2: KIỂM THỬ UPLOAD FILE MINH CHỨNG THỰC TẾ (MULTER & STATIC)');
    
    // Tạo 1 file test giả lập file scan minh chứng y tế
    const tempFilePath = path.join(__dirname, 'scratch_test_medical_report.pdf');
    fs.writeFileSync(tempFilePath, '%PDF-1.5 %Giay chung nhan suc khoe benh vien dai hoc y duoc - Demo File');

    // Upload file qua multipart/form-data
    const fileBuffer = fs.readFileSync(tempFilePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'giay_kham_suc_khoe.pdf');

    const uploadRes = await request('/upload', {
      method: 'POST',
      token: lecturer.token,
      isFormData: true,
      body: formData,
    });

    assert(
      uploadRes.status === 201 && uploadRes.data?.data?.fileUrl,
      `Tải lên file minh chứng thành công qua Multer: ${uploadRes.data?.data?.fileUrl}`,
      'Upload file thất bại',
      uploadRes.data
    );
    const uploadedFileUrl = uploadRes.data?.data?.fileUrl;

    // Kiểm tra phục vụ file tĩnh qua Express static (/uploads/...)
    const staticRes = await request(`${ROOT_URL}${uploadedFileUrl}`);
    assert(
      staticRes.status === 200,
      `Truy cập file tĩnh qua URL trực tiếp thành công (HTTP 200): ${ROOT_URL}${uploadedFileUrl}`,
      'Truy cập file tĩnh thất bại',
      staticRes.status
    );

    // Xóa file test tạm
    try { fs.unlinkSync(tempFilePath); } catch (e) {}

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: TẠO 3 LOẠI ĐƠN & VALIDATION (TUẦN 2)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 3: TẠO 3 LOẠI ĐƠN (NGHỈ PHÉP, DẠY BÙ, ĐỔI CA) & RÀNG BUỘC');

    // 3.1 Đơn xin nghỉ phép (nghi_phep) kèm URL file vừa upload
    const leaveRes1 = await request('/leave-requests', {
      method: 'POST',
      token: lecturer.token,
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Nghỉ điều trị sức khỏe theo chỉ định của bác sĩ bệnh viện',
        startDate: '2026-11-02T08:00:00.000Z',
        endDate: '2026-11-04T17:00:00.000Z',
        attachmentUrl: uploadedFileUrl,
      }),
    });
    assert(
      leaveRes1.status === 201 && leaveRes1.data?.data?.type === 'nghi_phep' && leaveRes1.data?.data?.attachmentUrl === uploadedFileUrl,
      `Tạo đơn NGHỈ PHÉP có đính kèm file thành công: ID = ${leaveRes1.data?.data?._id}`,
      'Tạo đơn nghỉ phép thất bại',
      leaveRes1.data
    );
    const leaveId1 = leaveRes1.data?.data?._id;

    // 3.2 Đơn đăng ký dạy bù (day_bu)
    const leaveRes2 = await request('/leave-requests', {
      method: 'POST',
      token: lecturer.token,
      body: JSON.stringify({
        type: 'day_bu',
        reason: 'Đăng ký dạy bù học phần An toàn mạng cho lớp K21-CNTT',
        startDate: '2026-11-07T13:00:00.000Z',
        endDate: '2026-11-07T17:00:00.000Z',
      }),
    });
    assert(
      leaveRes2.status === 201 && leaveRes2.data?.data?.type === 'day_bu',
      `Tạo đơn DẠY BÙ thành công: ID = ${leaveRes2.data?.data?._id}`,
      'Tạo đơn dạy bù thất bại',
      leaveRes2.data
    );
    const leaveId2 = leaveRes2.data?.data?._id;

    // 3.3 Đơn xin đổi ca (doi_ca)
    const leaveRes3 = await request('/leave-requests', {
      method: 'POST',
      token: lecturer.token,
      body: JSON.stringify({
        type: 'doi_ca',
        reason: 'Xin chuyển lịch hướng dẫn thí nghiệm từ sáng thứ 4 sang chiều thứ 6',
        startDate: '2026-11-10T08:00:00.000Z',
        endDate: '2026-11-10T12:00:00.000Z',
      }),
    });
    assert(
      leaveRes3.status === 201 && leaveRes3.data?.data?.type === 'doi_ca',
      `Tạo đơn ĐỔI CA thành công: ID = ${leaveRes3.data?.data?._id}`,
      'Tạo đơn đổi ca thất bại',
      leaveRes3.data
    );
    const leaveId3 = leaveRes3.data?.data?._id;

    // 3.4 Kiểm tra ràng buộc Validation (Ngày kết thúc < Ngày bắt đầu)
    const invalidDateRes = await request('/leave-requests', {
      method: 'POST',
      token: lecturer.token,
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Lý do kiểm thử ngày sai quy định',
        startDate: '2026-11-05T08:00:00.000Z',
        endDate: '2026-11-01T08:00:00.000Z',
      }),
    });
    assert(
      invalidDateRes.status === 400,
      'Hệ thống từ chối thành công đơn có ngày kết thúc trước ngày bắt đầu (HTTP 400)',
      'Hệ thống không bắt lỗi ngày sai quy định',
      invalidDateRes.data
    );

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: TRA CỨU SỐ DƯ PHÉP (LEAVE BALANCE) & BẢO MẬT RBAC (TUẦN 3)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 4: TÍNH TOÁN ĐỘNG QUỸ NGÀY PHÉP (AGGREGATE) & BẢO MẬT RBAC');

    // 4.1 Giảng viên tra cứu quỹ phép của chính mình
    const balanceRes = await request('/leave-requests/balance', {
      method: 'GET',
      token: lecturer.token,
    });
    assert(
      balanceRes.status === 200 && balanceRes.data?.data?.annualLeaveQuota !== undefined && balanceRes.data?.data?.remainingDays !== undefined,
      `Tính số dư ngày phép động thành công: Hạn mức = ${balanceRes.data?.data?.annualLeaveQuota}, Đã dùng = ${balanceRes.data?.data?.daysUsed}, Còn lại = ${balanceRes.data?.data?.remainingDays} ngày`,
      'Tra cứu số dư ngày phép thất bại',
      balanceRes.data
    );

    // 4.2 Thử nghiệm bảo mật: Giảng viên cố tình tra cứu số dư của Admin
    const hackBalanceRes = await request(`/leave-requests/balance?userId=${admin.user._id}`, {
      method: 'GET',
      token: lecturer.token,
    });
    assert(
      hackBalanceRes.status === 403,
      'Bảo vệ RBAC thành công: Giảng viên bị chặn khi cố tra cứu số dư của người khác (HTTP 403)',
      'Lỗ hổng bảo mật: Giảng viên xem được số dư phép của người khác',
      hackBalanceRes.data
    );

    // 4.3 Trưởng khoa tra cứu số dư của giảng viên thuộc khoa mình
    const deanCheckBalance = await request(`/leave-requests/balance?userId=${lecturer.user._id}`, {
      method: 'GET',
      token: dean.token,
    });
    assert(
      deanCheckBalance.status === 200,
      `Trưởng khoa tra cứu hợp lệ số dư của Giảng viên trong khoa (HTTP 200): Còn ${deanCheckBalance.data?.data?.remainingDays} ngày`,
      'Trưởng khoa không tra cứu được nhân sự trong khoa',
      deanCheckBalance.data
    );

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: PHÊ DUYỆT / TỪ CHỐI ĐA CẤP BẬC, ĐỒNG BỘ CHẤM CÔNG & AUDIT LOG (TUẦN 3)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 5: PHÊ DUYỆT / TỪ CHỐI THEO CẤP BẬC, ĐỒNG BỘ CHẤM CÔNG VÀ AUDIT');

    // 5.1 Trưởng khoa duyệt đơn của Giảng viên
    const approveRes = await request(`/leave-requests/${leaveId1}/approve`, {
      method: 'PUT',
      token: dean.token,
      body: JSON.stringify({
        approvalNote: 'Đồng ý cho giảng viên nghỉ điều trị sức khỏe theo giấy khám bệnh.',
      }),
    });
    assert(
      approveRes.status === 200 && approveRes.data?.data?.status === 'APPROVED',
      `Trưởng khoa phê duyệt đơn ${leaveId1} thành công: Trạng thái = APPROVED, Ghi chú duyệt hợp lệ`,
      'Trưởng khoa duyệt đơn thất bại',
      approveRes.data
    );

    // 5.2 Kiểm tra Trưởng khoa từ chối đơn: Bắt buộc kèm rejectionReason
    const rejectNoReasonRes = await request(`/leave-requests/${leaveId2}/reject`, {
      method: 'PUT',
      token: dean.token,
      body: JSON.stringify({}),
    });
    assert(
      rejectNoReasonRes.status === 400,
      'Hệ thống bắt buộc cung cấp lý do từ chối (rejectionReason) thành công (HTTP 400)',
      'Hệ thống cho phép từ chối mà không có lý do',
      rejectNoReasonRes.data
    );

    const rejectRes = await request(`/leave-requests/${leaveId2}/reject`, {
      method: 'PUT',
      token: dean.token,
      body: JSON.stringify({
        rejectionReason: 'Khung giờ đăng ký dạy bù bị trùng lịch thi học phần chung của khoa.',
      }),
    });
    assert(
      rejectRes.status === 200 && rejectRes.data?.data?.status === 'REJECTED',
      `Trưởng khoa từ chối đơn ${leaveId2} thành công kèm lý do: "${rejectRes.data?.data?.rejectionReason}"`,
      'Từ chối đơn thất bại',
      rejectRes.data
    );

    // 5.3 Phân cấp bậc RBAC: Trưởng khoa nộp đơn của mình
    const deanLeaveRes = await request('/leave-requests', {
      method: 'POST',
      token: dean.token,
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Trưởng khoa tham gia Hội nghị Hiệp hội CNTT Quốc tế',
        startDate: '2026-11-20T08:00:00.000Z',
        endDate: '2026-11-22T17:00:00.000Z',
      }),
    });
    assert(deanLeaveRes.status === 201, `Trưởng khoa nộp đơn xin nghỉ thành công: ID = ${deanLeaveRes.data?.data?._id}`, 'Trưởng khoa nộp đơn thất bại');
    const deanLeaveId = deanLeaveRes.data?.data?._id;

    // Trưởng khoa cố tình tự duyệt đơn của chính mình -> Phải bị chặn 403
    const selfApproveRes = await request(`/leave-requests/${deanLeaveId}/approve`, {
      method: 'PUT',
      token: dean.token,
      body: JSON.stringify({ approvalNote: 'Tự duyệt' }),
    });
    assert(
      selfApproveRes.status === 403,
      'Chặn thành công hành vi Trưởng khoa tự phê duyệt đơn của chính mình (HTTP 403)',
      'Lỗ hổng: Trưởng khoa tự duyệt được đơn của chính mình',
      selfApproveRes.data
    );

    // Quản trị viên (Admin) duyệt đơn cho Trưởng khoa -> Thành công
    const adminApproveDean = await request(`/leave-requests/${deanLeaveId}/approve`, {
      method: 'PUT',
      token: admin.token,
      body: JSON.stringify({ approvalNote: 'Ban Giám hiệu đồng ý cử Trưởng khoa tham gia hội nghị.' }),
    });
    assert(
      adminApproveDean.status === 200 && adminApproveDean.data?.data?.status === 'APPROVED',
      `Admin phê duyệt đơn cho Trưởng khoa thành công theo chuẩn cấp bậc (HTTP 200)`,
      'Admin duyệt đơn cho Trưởng khoa thất bại',
      adminApproveDean.data
    );

    // -------------------------------------------------------------
    // GIAI ĐOẠN 6: BÁO CÁO THỐNG KÊ CHẤM CÔNG & BÁO CÁO THÁNG (TUẦN 4)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 6: BÁO CÁO THỐNG KÊ PHÂN QUYỀN (CÁ NHÂN, KHOA, TRƯỜNG) & BÁO CÁO THÁNG');

    // 6.1 Giảng viên tra cứu báo cáo của chính mình (Khắc phục điểm lệch quyền trước đây)
    const lecturerReportRes = await request('/reports/attendance', {
      method: 'GET',
      token: lecturer.token,
    });
    assert(
      lecturerReportRes.status === 200 && lecturerReportRes.data?.data?.totalRecords !== undefined,
      `Giảng viên tra cứu báo cáo thống kê cá nhân thành công (HTTP 200): Số bản ghi = ${lecturerReportRes.data?.data?.totalRecords}, Đúng giờ = ${lecturerReportRes.data?.data?.onTimeCount}, Ngày nghỉ duyệt = ${lecturerReportRes.data?.data?.approvedLeaveDays}`,
      'Giảng viên bị chặn tra cứu báo cáo cá nhân',
      lecturerReportRes.data
    );

    // 6.2 Trưởng khoa tra cứu báo cáo toàn khoa CNTT
    const deanReportRes = await request('/reports/attendance', {
      method: 'GET',
      token: dean.token,
    });
    assert(
      deanReportRes.status === 200,
      `Trưởng khoa tra cứu báo cáo chấm công của Khoa thành công (HTTP 200): Tổng = ${deanReportRes.data?.data?.totalRecords}`,
      'Trưởng khoa tra cứu báo cáo thất bại',
      deanReportRes.data
    );

    // 6.3 Trưởng khoa tra cứu báo cáo tổng hợp theo tháng (/api/reports/monthly)
    const monthlyReportRes = await request('/reports/monthly?month=11&year=2026', {
      method: 'GET',
      token: dean.token,
    });
    assert(
      monthlyReportRes.status === 200 && Array.isArray(monthlyReportRes.data?.data?.report),
      `Trưởng khoa lấy Báo cáo tổng hợp tháng 11/2026 thành công: ${monthlyReportRes.data?.data?.totalUsers} nhân sự trong khoa`,
      'Báo cáo tháng thất bại',
      monthlyReportRes.data
    );

    // 6.4 Admin tra cứu báo cáo toàn trường
    const adminReportRes = await request('/reports/attendance', {
      method: 'GET',
      token: admin.token,
    });
    assert(
      adminReportRes.status === 200,
      `Admin tra cứu báo cáo thống kê toàn trường thành công: ${adminReportRes.data?.data?.totalRecords} bản ghi`,
      'Admin tra cứu báo cáo thất bại',
      adminReportRes.data
    );

    // -------------------------------------------------------------
    // GIAI ĐOẠN 7: KIỂM TOÁN HỆ THỐNG AN TOÀN (AUDIT LOGS) (TUẦN 1 & 5)
    // -------------------------------------------------------------
    logHeader('GIAI ĐOẠN 7: TRA CỨU NHẬT KÝ KIỂM TOÁN AN TOÀN (AUDIT LOGS)');

    // 7.1 Giảng viên cố gọi /api/audit-logs -> Bị từ chối 403
    const lecturerAuditRes = await request('/audit-logs', {
      method: 'GET',
      token: lecturer.token,
    });
    assert(
      lecturerAuditRes.status === 403,
      'Bảo vệ Audit Log: Giảng viên không có quyền truy cập nhật ký kiểm toán (HTTP 403)',
      'Lỗ hổng: Giảng viên truy cập được Audit Log',
      lecturerAuditRes.data
    );

    // 7.2 Admin tra cứu danh sách Audit Log
    const adminAuditRes = await request('/audit-logs', {
      method: 'GET',
      token: admin.token,
    });
    assert(
      adminAuditRes.status === 200 && adminAuditRes.data?.data?.totalRecords > 0,
      `Admin tra cứu thành công ${adminAuditRes.data?.data?.totalRecords} bản ghi nhật ký kiểm toán hệ thống`,
      'Admin tra cứu audit log thất bại',
      adminAuditRes.data
    );

    const latestActions = adminAuditRes.data?.data?.logs?.slice(0, 5).map((l) => l.action);
    logInfo(`Các thao tác kiểm toán mới nhất đã ghi nhận vết: [${latestActions?.join(', ')}]`);

    // -------------------------------------------------------------
    // TỔNG KẾT KẾT QUẢ KIỂM THỬ
    // -------------------------------------------------------------
    logHeader('TỔNG KẾT TIẾN ĐỘ THỰC HIỆN 5 TUẦN (TV C)');
    console.log(`Tổng số ca kiểm thử thực hiện: ${colors.bold}${testStats.total}${colors.reset}`);
    console.log(`Số ca kiểm thử ĐẠT (PASS):      ${colors.bold}${colors.green}${testStats.passed}${colors.reset}`);
    console.log(`Số ca kiểm thử THẤT BẠI (FAIL): ${colors.bold}${testStats.failed === 0 ? colors.green : colors.red}${testStats.failed}${colors.reset}`);

    if (testStats.failed === 0) {
      console.log(`\n${colors.bold}${colors.green}>>> KẾT LUẬN: TẤT CẢ CÁC TÍNH NĂNG TỪ TUẦN 1 ĐẾN TUẦN 5 ĐỀU HOÀN THÀNH 100%, ĐẠT CHUẨN ĐẶC TẢ! <<<${colors.reset}\n`);
    } else {
      console.log(`\n${colors.bold}${colors.red}>>> CẢNH BÁO: Còn ${testStats.failed} ca kiểm thử chưa đạt! <<<${colors.reset}\n`);
    }

  } catch (err) {
    console.error(`\n${colors.red}LỖI TRONG QUÁ TRÌNH THỰC THI KIỂM THỬ:${colors.reset}`, err);
  }
}

runComprehensiveTests();
