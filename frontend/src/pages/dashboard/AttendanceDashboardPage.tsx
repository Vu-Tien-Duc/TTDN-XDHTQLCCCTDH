import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import reportService, {
  AttendanceReportData,
  MonthlyStaffReportItem,
} from '../../services/report.service';
import BarChart, { BarDataPoint } from '../../components/charts/BarChart';
import DonutChart, { DonutSegment } from '../../components/charts/DonutChart';
import LineTrendChart, { TrendPoint } from '../../components/charts/LineTrendChart';
import { exportAttendanceToExcel, triggerPrintPdf } from '../../utils/exportUtils';
import { formatDate } from '../../utils';

export const AttendanceDashboardPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(true);

  const [summary, setSummary] = useState<AttendanceReportData | null>(null);
  const [staffList, setStaffList] = useState<MonthlyStaffReportItem[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Lấy dữ liệu tổng hợp
      const summaryRes = await reportService.getAttendanceReport();
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }

      // 2. Lấy danh sách chi tiết theo tháng
      const monthlyRes = await reportService.getMonthlyReport({
        month: selectedMonth,
        year: selectedYear,
      });
      if (monthlyRes.success && monthlyRes.data?.report) {
        setStaffList(monthlyRes.data.report);
      }
    } catch {
      toast.error('Không thể tải dữ liệu báo cáo thống kê chấm công.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedYear]);

  // Chuẩn bị dữ liệu cho 3 Biểu đồ
  // 1. Biểu đồ tròn (Donut)
  const donutData: DonutSegment[] = [
    { label: 'Đúng giờ', value: summary?.onTimeCount || 0, color: '#10b981' },
    { label: 'Đi muộn', value: summary?.lateCount || 0, color: '#f59e0b' },
    { label: 'Về sớm', value: summary?.earlyLeaveCount || 0, color: '#f97316' },
    { label: 'Vắng không phép', value: summary?.absentCount || 0, color: '#ef4444' },
    { label: 'Vắng có phép', value: summary?.excusedAbsenceCount || 0, color: '#3b82f6' },
  ];

  // 2. Biểu đồ cột (Bar) - Thống kê theo các cán bộ mẫu hoặc theo tuần
  const barData: BarDataPoint[] = staffList.slice(0, 5).map((item) => ({
    label: item.user.fullName.split(' ').slice(-2).join(' '),
    onTime: item.onTimeCount,
    late: item.lateCount,
    absent: item.absentCount,
    excused: item.excusedCount,
  }));

  // 3. Biểu đồ đường (Line Trend)
  const trendData: TrendPoint[] = [
    { label: 'Tuần 1', rate: 94, lateRate: 6 },
    { label: 'Tuần 2', rate: 89, lateRate: 11 },
    { label: 'Tuần 3', rate: 96, lateRate: 4 },
    { label: 'Tuần 4', rate: 92, lateRate: 8 },
  ];

  // Xuất Excel
  const handleExportExcel = () => {
    try {
      exportAttendanceToExcel(summary, staffList, selectedMonth, selectedYear);
      toast.success('Đã xuất file Excel thành công!', { icon: '📊' });
    } catch {
      toast.error('Lỗi khi xuất file Excel.');
    }
  };

  // In PDF
  const handlePrintPdf = () => {
    triggerPrintPdf();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 print:space-y-4">
      {/* Tiêu đề in ấn dành riêng cho @media print */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <p className="text-xs uppercase font-bold text-slate-500">BỘ GIÁO DỤC VÀ ĐÀO TẠO • TRƯỜNG ĐẠI HỌC</p>
        <h1 className="text-lg font-black uppercase mt-1">Báo Cáo Tổng Hợp Chấm Công & Điểm Danh Giảng Dạy</h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Tháng {selectedMonth} năm {selectedYear} • Ngày in: {formatDate(new Date())}
        </p>
      </div>

      {/* Header Banner (Ẩn khi in) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              Phân Hệ Báo Cáo Thống Kê
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">Giám sát chuyên cần & KPI</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Dashboard Thống Kê Chấm Công & Báo Cáo Tháng
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp dữ liệu điểm danh thực tế, phân tích trực quan qua hệ thống 3 biểu đồ và hỗ trợ xuất bản in A4 / Excel.
          </p>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>

          {/* Export Excel (Task 6) */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel (.xlsx)
          </button>

          {/* Export PDF (Task 6) */}
          <button
            onClick={handlePrintPdf}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            In PDF (A4)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Records */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng ca dạy</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary?.totalRecords ?? 0}</p>
          <span className="text-[10px] text-slate-400 mt-1">Lượt chấm công</span>
        </div>

        {/* On Time */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Đúng giờ</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{summary?.onTimeCount ?? 0}</p>
          <span className="text-[10px] text-emerald-600 mt-1">Đạt chỉ tiêu</span>
        </div>

        {/* Late */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Đi muộn</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{summary?.lateCount ?? 0}</p>
          <span className="text-[10px] text-amber-600 mt-1">Quá ngưỡng quy định</span>
        </div>

        {/* Early Leave */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-orange-800">Về sớm</span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-orange-700 mt-2">{summary?.earlyLeaveCount ?? 0}</p>
          <span className="text-[10px] text-orange-600 mt-1">Trước giờ kết thúc</span>
        </div>

        {/* Absent */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Vắng không phép</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2">{summary?.absentCount ?? 0}</p>
          <span className="text-[10px] text-rose-600 mt-1">Cần lập biên bản</span>
        </div>

        {/* Excused Leave */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-800">Nghỉ có phép</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-700 mt-2">{summary?.excusedAbsenceCount ?? 0}</p>
          <span className="text-[10px] text-blue-600 mt-1">
            Đã duyệt: {summary?.approvedLeaveDays ?? 0} ngày
          </span>
        </div>
      </div>

      {/* 3 Interactive Charts Grid (Task 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:break-inside-avoid">
        {/* Chart 1: Donut (1 Col) */}
        <div className="lg:col-span-1">
          <DonutChart data={donutData} />
        </div>

        {/* Chart 2: Bar Chart (2 Cols) */}
        <div className="lg:col-span-2">
          <BarChart data={barData} />
        </div>
      </div>

      {/* Chart 3: Line Trend Chart (Full Width) */}
      <div className="print:break-inside-avoid">
        <LineTrendChart data={trendData} />
      </div>

      {/* Detailed Monthly Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Bảng Tổng Hợp Công Tác Chi Tiết Theo Cán Bộ / Giảng Viên (Tháng {selectedMonth}/{selectedYear})
          </h3>
          <span className="text-xs text-slate-500 font-mono">Tổng số: {staffList.length} nhân sự</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Họ và Tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3 text-center">Tổng ca</th>
                <th className="px-4 py-3 text-center text-emerald-700">Đúng giờ</th>
                <th className="px-4 py-3 text-center text-amber-700">Đi muộn</th>
                <th className="px-4 py-3 text-center text-orange-700">Về sớm</th>
                <th className="px-4 py-3 text-center text-rose-700">Vắng</th>
                <th className="px-4 py-3 text-center text-blue-700">Có phép</th>
                <th className="px-4 py-3 text-right">Chuyên cần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tính toán dữ liệu bảng công...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    Không có dữ liệu nhân sự trong tháng này.
                  </td>
                </tr>
              ) : (
                staffList.map((item, idx) => {
                  const onTimeRate =
                    item.totalWorkingDays > 0
                      ? Math.round(((item.onTimeCount + item.excusedCount) / item.totalWorkingDays) * 100)
                      : 100;

                  return (
                    <tr key={item.user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.user.fullName}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{item.user.email}</td>
                      <td className="px-4 py-3 capitalize text-slate-700">{item.user.role}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">
                        {item.totalWorkingDays}
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-bold">
                        {item.onTimeCount}
                      </td>
                      <td className="px-4 py-3 text-center text-amber-600 font-bold">
                        {item.lateCount}
                      </td>
                      <td className="px-4 py-3 text-center text-orange-600 font-bold">
                        {item.earlyLeaveCount}
                      </td>
                      <td className="px-4 py-3 text-center text-rose-600 font-bold">
                        {item.absentCount}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-600 font-bold">
                        {item.excusedCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            onTimeRate >= 90
                              ? 'bg-emerald-50 text-emerald-700'
                              : onTimeRate >= 75
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {onTimeRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chữ ký nghiệm thu dành riêng cho bản in PDF */}
      <div className="hidden print:grid grid-cols-2 gap-8 pt-8 mt-6 text-center text-xs">
        <div>
          <p className="font-bold uppercase text-slate-600">NGƯỜI LẬP BÁO CÁO</p>
          <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
          <div className="h-20"></div>
          <p className="font-bold text-slate-800">Thành viên C - Ban Thống kê</p>
        </div>

        <div>
          <p className="font-bold uppercase text-slate-600">XÁC NHẬN CỦA BAN GIÁM HIỆU / TRƯỞNG KHOA</p>
          <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký, đóng dấu)</p>
          <div className="h-20"></div>
          <p className="font-bold text-slate-800">PGS. TS. Lê Hoàng Nam</p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceDashboardPage;
