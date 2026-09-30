import * as XLSX from 'xlsx';
import {
  AttendanceReportData,
  MonthlyStaffReportItem,
  ExportReportResponse,
} from '../services/report.service';
import { formatDate } from './index';

/**
 * Kiểm tra đối tượng có phải là ExportReportResponse đầy đủ 5 sheet không
 */
function isFullExportData(obj: any): obj is ExportReportResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    'overview' in obj &&
    'attendanceLogs' in obj &&
    'leaveRequests' in obj &&
    'staffStats' in obj &&
    'dailyStats' in obj
  );
}

/**
 * Xuất báo cáo chấm công ra file Excel đa sheet chuyên nghiệp (5 Sheets chuẩn)
 */
export function exportAttendanceToExcel(
  exportDataOrSummary: ExportReportResponse | AttendanceReportData | null,
  staffListOrFileName?: MonthlyStaffReportItem[] | string,
  month?: number,
  year?: number
) {
  const wb = XLSX.utils.book_new();

  // TRƯỜNG HỢP 1: Dữ liệu trích xuất đầy đủ 5 Sheets từ MongoDB qua reportService.getExportData
  if (isFullExportData(exportDataOrSummary)) {
    const data = exportDataOrSummary;
    const ov = data.overview;

    // 1. Sheet "Tổng quan"
    const summaryRows: (string | number)[][] = [
      ['BÁO CÁO TỔNG HỢP CHẤM CÔNG VÀ CHUYÊN CẦN TOÀN DIỆN'],
      [`Kỳ báo cáo: ${ov.period}`],
      [`Đơn vị / Khoa: ${ov.department}`],
      [`Thời gian trích xuất: ${ov.exportedAt}`],
      [],
      ['Chỉ số thống kê', 'Số lượng ghi nhận', 'Đơn vị tính', 'Tỷ lệ / Đánh giá'],
      ['Tổng số nhân sự theo dõi', ov.totalUsers, 'người', ''],
      ['Tổng số ca / lượt chấm công', ov.totalShifts, 'ca', '100%'],
      [
        'Số lượt đúng giờ',
        ov.onTimeCount,
        'lượt',
        `${ov.totalShifts > 0 ? Math.round((ov.onTimeCount / ov.totalShifts) * 100) : 0}%`,
      ],
      [
        'Số lượt đi muộn',
        ov.lateCount,
        'lượt',
        `${ov.totalShifts > 0 ? Math.round((ov.lateCount / ov.totalShifts) * 100) : 0}%`,
      ],
      [
        'Số lượt về sớm',
        ov.earlyLeaveCount,
        'lượt',
        `${ov.totalShifts > 0 ? Math.round((ov.earlyLeaveCount / ov.totalShifts) * 100) : 0}%`,
      ],
      [
        'Số lượt vắng mặt (không phép)',
        ov.absentCount,
        'lượt',
        `${ov.totalShifts > 0 ? Math.round((ov.absentCount / ov.totalShifts) * 100) : 0}%`,
      ],
      [
        'Số lượt vắng có phép',
        ov.excusedAbsenceCount,
        'lượt',
        `${ov.totalShifts > 0 ? Math.round((ov.excusedAbsenceCount / ov.totalShifts) * 100) : 0}%`,
      ],
      [
        'Tỷ lệ chuyên cần chung',
        `${ov.overallAttendanceRate}%`,
        '%',
        'Tính theo (Đúng giờ + Có phép) / Tổng số ca',
      ],
      ['Tổng số ngày nghỉ phép đã duyệt', ov.approvedLeaveDays, 'ngày', 'Đơn xin nghỉ phép hợp lệ'],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 16 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

    // 2. Sheet "Chi tiết chấm công"
    const attendanceHeaders = [
      'STT',
      'Mã nhân viên',
      'Họ và tên',
      'Khoa / Phòng ban',
      'Ngày làm việc',
      'Thứ',
      'Ca làm việc',
      'Khung giờ ca',
      'Giờ vào (Check-in)',
      'Giờ ra (Check-out)',
      'Trạng thái',
      'Số phút trễ/sớm',
      'Phương thức',
      'Tọa độ GPS',
      'Ghi chú',
    ];

    const attendanceRows: (string | number)[][] = [
      ['BẢNG CHI TIẾT LỊCH SỬ CHẤM CÔNG CÁN BỘ / GIẢNG VIÊN'],
      [`Kỳ báo cáo: ${ov.period} - Đơn vị: ${ov.department}`],
      [],
      attendanceHeaders,
    ];

    data.attendanceLogs.forEach((item) => {
      attendanceRows.push([
        item.stt,
        item.employeeId,
        item.fullName,
        item.departmentName,
        item.date,
        item.weekday,
        item.shiftName,
        item.scheduledTime,
        item.checkInTime,
        item.checkOutTime,
        item.status,
        item.lateEarlyMinutes,
        item.method,
        item.gpsCoordinates,
        item.notes,
      ]);
    });

    const wsAttendance = XLSX.utils.aoa_to_sheet(attendanceRows);
    wsAttendance['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 26 },
      { wch: 28 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 24 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Chi tiết chấm công');

    // 3. Sheet "Chi tiết đơn nghỉ"
    const leaveHeaders = [
      'STT',
      'Mã đơn',
      'Họ và tên',
      'Khoa / Phòng ban',
      'Loại đơn',
      'Ngày bắt đầu',
      'Ngày kết thúc',
      'Số ngày nghỉ',
      'Lý do xin nghỉ',
      'Trạng thái',
      'Người phê duyệt',
      'Thông tin duyệt / Lý do từ chối',
    ];

    const leaveRows: (string | number)[][] = [
      ['BẢNG THEO DÕI CHI TIẾT ĐƠN NGHỈ PHÉP & ĐỔI CA / DẠY BÙ'],
      [`Kỳ báo cáo: ${ov.period} - Đơn vị: ${ov.department}`],
      [],
      leaveHeaders,
    ];

    data.leaveRequests.forEach((item) => {
      leaveRows.push([
        item.stt,
        item.requestId,
        item.fullName,
        item.departmentName,
        item.leaveType,
        item.startDate,
        item.endDate,
        item.numberOfDays,
        item.reason,
        item.status,
        item.approver,
        item.approvalNote,
      ]);
    });

    const wsLeave = XLSX.utils.aoa_to_sheet(leaveRows);
    wsLeave['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 26 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 35 },
      { wch: 16 },
      { wch: 24 },
      { wch: 38 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLeave, 'Chi tiết đơn nghỉ');

    // 4. Sheet "Thống kê nhân sự"
    const staffHeaders = [
      'STT',
      'Mã nhân viên',
      'Họ và tên',
      'Email',
      'Khoa / Phòng ban',
      'Chức vụ / Vai trò',
      'Tổng ca công',
      'Đúng giờ',
      'Đi muộn',
      'Về sớm',
      'Vắng mặt',
      'Có phép',
      'Tỷ lệ chuyên cần (%)',
    ];

    const staffRows: (string | number)[][] = [
      ['BẢNG TỔNG HỢP CÔNG TÁC VÀ CHUYÊN CẦN THEO NHÂN SỰ'],
      [`Kỳ báo cáo: ${ov.period} - Đơn vị: ${ov.department}`],
      [],
      staffHeaders,
    ];

    data.staffStats.forEach((item) => {
      staffRows.push([
        item.stt,
        item.employeeId,
        item.fullName,
        item.email,
        item.departmentName,
        item.role,
        item.totalShifts,
        item.onTime,
        item.late,
        item.early,
        item.absent,
        item.excused,
        `${item.attendanceRate}%`,
      ]);
    });

    const wsStaff = XLSX.utils.aoa_to_sheet(staffRows);
    wsStaff['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 26 },
      { wch: 30 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStaff, 'Thống kê nhân sự');

    // 5. Sheet "Thống kê theo ngày"
    const dailyHeaders = [
      'STT',
      'Ngày',
      'Thứ',
      'Tổng ca trong ngày',
      'Đúng giờ',
      'Đi muộn',
      'Về sớm',
      'Vắng mặt',
      'Có phép',
      'Tỷ lệ chuyên cần (%)',
    ];

    const dailyRows: (string | number)[][] = [
      ['BẢNG THỐNG KÊ CHẤM CÔNG THEO TỪNG NGÀY TRONG KỲ'],
      [`Kỳ báo cáo: ${ov.period} - Đơn vị: ${ov.department}`],
      [],
      dailyHeaders,
    ];

    data.dailyStats.forEach((item) => {
      dailyRows.push([
        item.stt,
        item.date,
        item.weekday,
        item.totalShifts,
        item.onTime,
        item.late,
        item.early,
        item.absent,
        item.excused,
        `${item.attendanceRate}%`,
      ]);
    });

    const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
    wsDaily['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Thống kê theo ngày');

    // Lưu file Excel
    const safePeriod = ov.period.replace(/[\/\\:*?"<>| ]+/g, '_');
    const fileName =
      typeof staffListOrFileName === 'string'
        ? staffListOrFileName
        : `Bao_Cao_Cham_Cong_${safePeriod}.xlsx`;

    XLSX.writeFile(wb, fileName);
    return;
  }

  // TRƯỜNG HỢP 2: Fallback tương thích ngược với danh sách nhân sự đơn giản
  const summary = exportDataOrSummary as AttendanceReportData | null;
  const staffList = Array.isArray(staffListOrFileName) ? staffListOrFileName : [];
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  // 1. Sheet Tổng Hợp (Summary)
  const summaryRows = [
    ['BÁO CÁO TỔNG HỢP CHẤM CÔNG VÀ NGHỈ PHÉP'],
    [`Thời gian: Tháng ${m} năm ${y}`],
    [`Ngày xuất báo cáo: ${formatDate(new Date())}`],
    [],
    ['Chỉ số thống kê', 'Số lượng ghi nhận', 'Đơn vị tính'],
    ['Tổng số lượt chấm công', summary?.totalRecords ?? 0, 'lượt'],
    ['Số lượt đúng giờ', summary?.onTimeCount ?? 0, 'lượt'],
    ['Số lượt đi muộn', summary?.lateCount ?? 0, 'lượt'],
    ['Số lượt về sớm', summary?.earlyLeaveCount ?? 0, 'lượt'],
    ['Số lượt vắng mặt (không phép)', summary?.absentCount ?? 0, 'lượt'],
    ['Số lượt vắng có phép', summary?.excusedAbsenceCount ?? 0, 'lượt'],
    ['Tổng số ngày nghỉ phép đã duyệt', summary?.approvedLeaveDays ?? 0, 'ngày'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

  // 2. Sheet Chi Tiết Cán Bộ
  const staffRows = [
    ['BẢNG TỔNG HỢP CÔNG TÁC CHI TIẾT THEO CÁN BỘ / GIẢNG VIÊN'],
    [`Tháng ${m}/${y}`],
    [],
    [
      'STT',
      'Họ và Tên',
      'Email',
      'Vai trò',
      'Tổng ca công',
      'Đúng giờ',
      'Đi muộn',
      'Về sớm',
      'Vắng mặt',
      'Có phép',
      'Tỷ lệ chuyên cần (%)',
    ],
  ];

  staffList.forEach((item, index) => {
    const onTimeRate =
      item.totalWorkingDays > 0
        ? Math.round(((item.onTimeCount + item.excusedCount) / item.totalWorkingDays) * 100)
        : 100;

    staffRows.push([
      (index + 1).toString(),
      item.user.fullName,
      item.user.email,
      item.user.role === 'truongkhoa' ? 'Trưởng Khoa' : item.user.role === 'giangvien' ? 'Giảng Viên' : 'Nhân Viên',
      item.totalWorkingDays.toString(),
      item.onTimeCount.toString(),
      item.lateCount.toString(),
      item.earlyLeaveCount.toString(),
      item.absentCount.toString(),
      item.excusedCount.toString(),
      `${onTimeRate}%`,
    ]);
  });

  const wsStaff = XLSX.utils.aoa_to_sheet(staffRows);
  wsStaff['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 32 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Thống kê nhân sự');

  const fileName = `Bao_Cao_Cham_Cong_Thang_${m}_${y}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Kích hoạt in PDF trình duyệt
 */
export function triggerPrintPdf() {
  window.print();
}

