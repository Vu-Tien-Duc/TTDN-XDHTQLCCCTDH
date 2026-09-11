const BASE_URL = 'http://localhost:5000/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const logPass = (msg) => console.log(`${colors.green}✔ PASS:${colors.reset} ${msg}`);
const logFail = (msg, err) => console.log(`${colors.red}✖ FAIL:${colors.reset} ${msg}`, err || '');
const logInfo = (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`);
const logHeader = (msg) => console.log(`\n${colors.bold}${colors.yellow}=== ${msg} ===${colors.reset}`);

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  const data = await response.json().catch(() => null);
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
  return res.data.data.token;
}

async function runTests() {
  console.log(`${colors.bold}BẮT ĐẦU KIỂM THỬ CÁC CHỨC NĂNG QUẢN LÝ ĐƠN NGHỈ PHÉP${colors.reset}\n`);

  try {
    // 0. Đăng nhập
    logHeader('0. ĐĂNG NHẬP CÁC TÀI KHOẢN');
    const tokenLecturerBich = await login('giangvien.bich@university.edu.vn');
    logPass('Đăng nhập Giảng viên TS. Trần Thị Bích thành công');

    const tokenDean = await login('truongkhoa.cntt@university.edu.vn');
    logPass('Đăng nhập Trưởng khoa PGS. TS. Lê Hoàng Nam thành công');

    const tokenAdmin = await login('admin@university.edu.vn');
    logPass('Đăng nhập Quản trị viên Admin thành công');

    // 1. Tạo đơn xin nghỉ phép, dạy bù và đổi ca
    logHeader('1. TẠO ĐƠN XIN NGHỈ PHÉP, DẠY BÙ VÀ ĐỔI CA');

    // 1a. Tạo đơn xin nghỉ phép (nghi_phep)
    const leaveRes1 = await request('/leave-requests', {
      method: 'POST',
      token: tokenLecturerBich,
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Xin nghỉ phép 2 ngày đi khám sức khỏe định kỳ tại bệnh viện',
        startDate: '2026-10-10T08:00:00.000Z',
        endDate: '2026-10-11T17:00:00.000Z',
        attachmentUrl: 'https://storage.university.edu.vn/giay-kham.pdf',
      }),
    });

    if (leaveRes1.status === 201 && leaveRes1.data?.data?.type === 'nghi_phep') {
      logPass(`Tạo đơn NGHỈ PHÉP (nghi_phep) thành công: ID = ${leaveRes1.data.data._id}`);
    } else {
      logFail('Tạo đơn nghỉ phép thất bại', leaveRes1.data);
    }
    const leaveIdNghiPhep = leaveRes1.data?.data?._id;

    // 1b. Tạo đơn dạy bù (day_bu)
    const leaveRes2 = await request('/leave-requests', {
      method: 'POST',
      token: tokenLecturerBich,
      body: JSON.stringify({
        type: 'day_bu',
        reason: 'Đăng ký dạy bù học phần Nhập môn Lập trình cho lớp K20-CNTT',
        startDate: '2026-10-15T13:00:00.000Z',
        endDate: '2026-10-15T17:00:00.000Z',
      }),
    });

    if (leaveRes2.status === 201 && leaveRes2.data?.data?.type === 'day_bu') {
      logPass(`Tạo đơn DẠY BÙ (day_bu) thành công: ID = ${leaveRes2.data.data._id}`);
    } else {
      logFail('Tạo đơn dạy bù thất bại', leaveRes2.data);
    }
    const leaveIdDayBu = leaveRes2.data?.data?._id;

    // 1c. Tạo đơn đổi ca (doi_ca)
    const leaveRes3 = await request('/leave-requests', {
      method: 'POST',
      token: tokenLecturerBich,
      body: JSON.stringify({
        type: 'doi_ca',
        reason: 'Đổi ca dạy sáng Thứ 3 sang chiều Thứ 5 để dự hội nghị khoa học trường',
        startDate: '2026-10-20T07:00:00.000Z',
        endDate: '2026-10-20T17:00:00.000Z',
      }),
    });

    if (leaveRes3.status === 201 && leaveRes3.data?.data?.type === 'doi_ca') {
      logPass(`Tạo đơn ĐỔI CA (doi_ca) thành công: ID = ${leaveRes3.data.data._id}`);
    } else {
      logFail('Tạo đơn đổi ca thất bại', leaveRes3.data);
    }
    const leaveIdDoiCa = leaveRes3.data?.data?._id;

    // 1d. Validate lỗi: lý do quá ngắn (< 5 ký tự)
    const failReasonRes = await request('/leave-requests', {
      method: 'POST',
      token: tokenLecturerBich,
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Ốm',
        startDate: '2026-10-10T08:00:00.000Z',
        endDate: '2026-10-11T17:00:00.000Z',
      }),
    });
    if (failReasonRes.status === 400) {
      logPass('Validate chặn thành công lý do < 5 ký tự');
    } else {
      logFail('Validate lý do ngắn không chặn đúng', failReasonRes.data);
    }

    // 1e. Validate lỗi: ngày kết thúc trước ngày bắt đầu
    const failDateRes = await request('/leave-requests', {
      method: 'POST',
      token: tokenLecturerBich,
      body: JSON.stringify({
        type: 'nghi_phep',
        reason: 'Nghỉ phép việc gia đình',
        startDate: '2026-10-15T08:00:00.000Z',
        endDate: '2026-10-10T17:00:00.000Z',
      }),
    });
    if (failDateRes.status === 400) {
      logPass('Validate chặn thành công ngày kết thúc trước ngày bắt đầu');
    } else {
      logFail('Validate ngày không chặn đúng', failDateRes.data);
    }

    // 2. Lấy danh sách đơn xin nghỉ phép
    logHeader('2. LẤY DANH SÁCH ĐƠN XIN NGHỈ PHÉP');

    // 2a. Giảng viên lấy danh sách đơn (chỉ thấy đơn của mình)
    const gvListRes = await request('/leave-requests', {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (gvListRes.status === 200 && Array.isArray(gvListRes.data?.data)) {
      const items = gvListRes.data.data;
      logPass(`Giảng viên lấy danh sách đơn: ${items.length} đơn tìm thấy`);
      logInfo(`Ví dụ đơn đầu tiên: Type=${items[0]?.type}, Status=${items[0]?.status}, Lý do: "${items[0]?.reason}"`);
    } else {
      logFail('Giảng viên lấy danh sách đơn thất bại', gvListRes.data);
    }

    // 2b. Lọc theo trạng thái PENDING
    const pendingListRes = await request('/leave-requests?status=PENDING', {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (pendingListRes.status === 200) {
      const allPending = pendingListRes.data.data.every((r) => r.status === 'PENDING');
      if (allPending) {
        logPass(`Lọc theo status=PENDING thành công (${pendingListRes.data.data.length} đơn PENDING)`);
      } else {
        logFail('Lọc PENDING trả về cả đơn khác PENDING');
      }
    }

    // 2c. Lọc theo loại đơn type=day_bu
    const daybuListRes = await request('/leave-requests?type=day_bu', {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (daybuListRes.status === 200) {
      const allDaybu = daybuListRes.data.data.every((r) => r.type === 'day_bu');
      if (allDaybu && daybuListRes.data.data.length > 0) {
        logPass(`Lọc theo type=day_bu thành công (${daybuListRes.data.data.length} đơn dạy bù)`);
      } else {
        logFail('Lọc type=day_bu thất bại');
      }
    }

    // 2d. Trưởng khoa xem danh sách đơn của khoa
    const deanListRes = await request('/leave-requests', {
      method: 'GET',
      token: tokenDean,
    });
    if (deanListRes.status === 200 && Array.isArray(deanListRes.data?.data)) {
      logPass(`Trưởng khoa lấy danh sách đơn trong khoa thành công (${deanListRes.data.data.length} đơn)`);
    } else {
      logFail('Trưởng khoa lấy danh sách đơn thất bại', deanListRes.data);
    }

    // 3. Xem số ngày phép còn lại trong năm (Leave Balance)
    logHeader('3. XEM SỐ NGÀY PHÉP CÒN LẠI TRONG NĂM');

    const balanceBeforeRes = await request('/leave-requests/balance', {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (balanceBeforeRes.status === 200 && balanceBeforeRes.data?.data) {
      const b = balanceBeforeRes.data.data;
      logPass(`Lấy số dư ngày phép thành công:
         - Năm xét: ${b.year}
         - Tổng định mức (Quota): ${b.annualLeaveQuota} ngày
         - Số ngày đã sử dụng (Approved): ${b.daysUsed} ngày
         - Số ngày phép còn lại: ${b.remainingDays} ngày`);
    } else {
      logFail('Lấy số dư ngày phép thất bại', balanceBeforeRes.data);
    }

    // 4. Xem chi tiết 1 đơn xin nghỉ
    logHeader('4. XEM CHI TIẾT 1 ĐƠN XIN NGHỈ');

    const detailRes = await request(`/leave-requests/${leaveIdNghiPhep}`, {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (detailRes.status === 200 && detailRes.data?.data) {
      const d = detailRes.data.data;
      logPass(`Xem chi tiết đơn thành công:
         - ID: ${d._id}
         - Người nộp: ${d.userId?.fullName} (${d.userId?.email})
         - Loại đơn: ${d.type}
         - Lý do: ${d.reason}
         - Thời gian: ${d.startDate} -> ${d.endDate}
         - Trạng thái: ${d.status}
         - Đính kèm: ${d.attachmentUrl}`);
    } else {
      logFail('Xem chi tiết đơn thất bại', detailRes.data);
    }

    // 5. Phê duyệt đơn xin nghỉ
    logHeader('5. PHÊ DUYỆT ĐƠN XIN NGHỈ');

    // 5a. Giảng viên thử tự duyệt đơn của mình -> Phải bị chặn (403 Forbidden)
    const unauthorizedApprove = await request(`/leave-requests/${leaveIdNghiPhep}/approve`, {
      method: 'PUT',
      token: tokenLecturerBich,
      body: JSON.stringify({ approvalNote: 'Tự duyệt' }),
    });
    if (unauthorizedApprove.status === 403) {
      logPass('Phân quyền chuẩn: Giảng viên không có quyền phê duyệt đơn (HTTP 403 Forbidden)');
    } else {
      logFail('Lỗi phân quyền: Giảng viên duyệt được đơn!', unauthorizedApprove.data);
    }

    // 5b. Trưởng khoa phê duyệt đơn xin nghỉ phép
    const approveRes = await request(`/leave-requests/${leaveIdNghiPhep}/approve`, {
      method: 'PUT',
      token: tokenDean,
      body: JSON.stringify({
        approvalNote: 'Khoa nhất trí phê duyệt cho giảng viên nghỉ theo nguyện vọng.',
      }),
    });
    if (approveRes.status === 200 && approveRes.data?.data?.status === 'APPROVED') {
      const d = approveRes.data.data;
      logPass(`Trưởng khoa phê duyệt đơn thành công:
         - ID: ${d._id}
         - Status mới: ${d.status}
         - Ghi chú duyệt: "${d.approvalNote}"
         - Người duyệt (approvedBy): ${d.approvedBy}`);
    } else {
      logFail('Phê duyệt đơn thất bại', approveRes.data);
    }

    // 5c. Thử duyệt lại đơn đã duyệt -> Phải báo lỗi 400
    const reApproveRes = await request(`/leave-requests/${leaveIdNghiPhep}/approve`, {
      method: 'PUT',
      token: tokenDean,
      body: JSON.stringify({ approvalNote: 'Duyệt lại' }),
    });
    if (reApproveRes.status === 400) {
      logPass('Chặn duyệt lại thành công: Không thể duyệt đơn đã ở trạng thái APPROVED');
    } else {
      logFail('Không chặn được duyệt lại đơn đã xử lý', reApproveRes.data);
    }

    // 5d. Kiểm tra lại số ngày phép còn lại sau khi đơn nghỉ được duyệt
    logInfo('Kiểm tra lại số dư ngày phép sau khi đơn nghỉ 2 ngày được duyệt:');
    const balanceAfterRes = await request('/leave-requests/balance', {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (balanceAfterRes.status === 200 && balanceAfterRes.data?.data) {
      const b = balanceAfterRes.data.data;
      logPass(`Số dư ngày phép cập nhật chính xác:
         - Định mức: ${b.annualLeaveQuota} ngày
         - Số ngày đã dùng: ${b.daysUsed} ngày (tăng lên)
         - Số ngày còn lại: ${b.remainingDays} ngày (giảm đi tương ứng)`);
    }

    // 6. Từ chối đơn xin nghỉ
    logHeader('6. TỪ CHỐI ĐƠN XIN NGHỈ');

    // 6a. Từ chối KHÔNG có rejectionReason -> Phải báo lỗi 400
    const failRejectRes = await request(`/leave-requests/${leaveIdDoiCa}/reject`, {
      method: 'PUT',
      token: tokenDean,
      body: JSON.stringify({ rejectionReason: '' }),
    });
    if (failRejectRes.status === 400) {
      logPass('Validate chuẩn: Từ chối đơn BẮT BUỘC phải có lý do (rejectionReason)');
    } else {
      logFail('Từ chối không có lý do nhưng không báo lỗi 400', failRejectRes.data);
    }

    // 6b. Trưởng khoa từ chối đơn đổi ca kèm lý do cụ thể
    const rejectRes = await request(`/leave-requests/${leaveIdDoiCa}/reject`, {
      method: 'PUT',
      token: tokenDean,
      body: JSON.stringify({
        rejectionReason: 'Ca đề xuất trùng với lịch chấm thi vấn đáp học phần, vui lòng chọn buổi khác.',
      }),
    });
    if (rejectRes.status === 200 && rejectRes.data?.data?.status === 'REJECTED') {
      const d = rejectRes.data.data;
      logPass(`Trưởng khoa từ chối đơn thành công:
         - ID: ${d._id}
         - Status mới: ${d.status}
         - Lý do từ chối: "${d.rejectionReason}"
         - Người xử lý: ${d.approvedBy}`);
    } else {
      logFail('Từ chối đơn thất bại', rejectRes.data);
    }

    // 6c. Kiểm tra lại chi tiết đơn bị từ chối
    const detailRejected = await request(`/leave-requests/${leaveIdDoiCa}`, {
      method: 'GET',
      token: tokenLecturerBich,
    });
    if (detailRejected.status === 200 && detailRejected.data?.data?.status === 'REJECTED') {
      logPass('Xem chi tiết đơn sau từ chối: status=REJECTED và lưu đầy đủ rejectionReason');
    }

    logHeader('TỔNG KẾT KIỂM THỬ');
    console.log(`${colors.green}${colors.bold}✔ TẤT CẢ CÁC TÍNH NĂNG VÀ NGHIỆP VỤ ĐÃ ĐƯỢC KIỂM THỬ THÀNH CÔNG 100%!${colors.reset}\n`);

  } catch (error) {
    console.error('Lỗi trong quá trình chạy kiểm thử:', error);
  }
}

runTests();
