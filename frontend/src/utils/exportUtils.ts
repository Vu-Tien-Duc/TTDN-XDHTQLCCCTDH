import * as XLSX from 'xlsx';
import { AttendanceReportData, MonthlyStaffReportItem } from '../services/report.service';
import { formatDate } from './index';

/**
 * Xuất báo cáo chấm công ra file Excel đa sheet
 */
export function exportAttendanceToExcel(
  summary: AttendanceReportData | null,
  staffList: MonthlyStaffReportItem[],
  month: number,
  year: number
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Tổng Hợp (Summary)
  const summaryRows = [
    ['BÁO CÁO TỔNG HỢP CHẤM CÔNG VÀ NGHỈ PHÉP'],
    [`Thời gian: Tháng ${month} năm ${year}`],
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
  // Định độ rộng cột sheet 1
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng Hợp');

  // 2. Sheet Chi Tiết Cán Bộ (Staff Details)
  const staffRows = [
    ['BẢNG TỔNG HỢP CÔNG TÁC CHI TIẾT THEO CÁN BỘ / GIẢNG VIÊN'],
    [`Tháng ${month}/${year}`],
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
  // Độ rộng các cột sheet 2
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
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Chi Tiết Nhân Sự');

  // Lưu file
  const fileName = `Bao_Cao_Cham_Cong_Thang_${month}_${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Kích hoạt in PDF trình duyệt
 */
export function triggerPrintPdf() {
  window.print();
}
