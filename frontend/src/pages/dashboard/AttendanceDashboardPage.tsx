import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
  HelpCircle,
  Search,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Award,
  Info,
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
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const [summary, setSummary] = useState<AttendanceReportData | null>(null);
  const [staffList, setStaffList] = useState<MonthlyStaffReportItem[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<TrendPoint[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

      // 1. Lấy dữ liệu tổng hợp theo tháng và năm đã chọn
      const summaryRes = await reportService.getAttendanceReport({
        from: firstDayOfMonth,
        to: lastDayOfMonth,
      });
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }

      // 2. Lấy danh sách chi tiết theo tháng và xu hướng các tuần thực tế từ MongoDB
      const monthlyRes = await reportService.getMonthlyReport({
        month: selectedMonth,
        year: selectedYear,
      });
      if (monthlyRes.success && monthlyRes.data) {
        if (monthlyRes.data.report) {
          setStaffList(monthlyRes.data.report);
        }
        if (monthlyRes.data.weeklyTrend && monthlyRes.data.weeklyTrend.length > 0) {
          setWeeklyTrend(monthlyRes.data.weeklyTrend);
        }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedYear, searchTerm]);

  // Tính tỷ lệ chuyên cần tổng quan
  const totalShifts = summary?.totalRecords || 0;
  const onTimeShifts = summary?.onTimeCount || 0;
  const excusedShifts = summary?.excusedAbsenceCount || 0;
  const lateShifts = summary?.lateCount || 0;
  const earlyLeaveShifts = summary?.earlyLeaveCount || 0;
  const absentShifts = summary?.absentCount || 0;

  const validShifts = onTimeShifts + excusedShifts;
  const hasRecords = totalShifts > 0;
  const overallAttendanceRate = hasRecords ? Math.round((validShifts / totalShifts) * 100) : null;

  // Lọc danh sách nhân sự theo tìm kiếm
  const filteredStaffList = useMemo(() => {
    if (!searchTerm.trim()) return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(
      (s) =>
        s.user.fullName.toLowerCase().includes(term) ||
        s.user.email.toLowerCase().includes(term) ||
        s.user.role.toLowerCase().includes(term)
    );
  }, [staffList, searchTerm]);

  const totalPages = Math.ceil(filteredStaffList.length / pageSize) || 1;
  const paginatedStaffList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStaffList.slice(start, start + pageSize);
  }, [filteredStaffList, currentPage]);

  // Chuẩn bị dữ liệu cho 3 Biểu đồ
  // 1. Biểu đồ tròn (Donut)
  const donutData: DonutSegment[] = [
    { label: 'Đúng giờ', value: onTimeShifts, color: '#10b981' },
    { label: 'Đi muộn', value: lateShifts, color: '#f59e0b' },
    { label: 'Về sớm', value: earlyLeaveShifts, color: '#f97316' },
    { label: 'Vắng không phép', value: absentShifts, color: '#ef4444' },
    { label: 'Vắng có phép', value: excusedShifts, color: '#3b82f6' },
  ];

  // 2. Biểu đồ cột (Bar)
  const barData: BarDataPoint[] = filteredStaffList.slice(0, 5).map((item) => ({
    label: item.user.fullName.split(' ').slice(-2).join(' '),
    onTime: item.onTimeCount,
    late: item.lateCount,
    absent: item.absentCount,
    excused: item.excusedCount,
  }));

  // 3. Biểu đồ đường (Line Trend) - Dữ liệu thực từ MongoDB qua API
  const trendData: TrendPoint[] = useMemo(() => {
    if (weeklyTrend && weeklyTrend.length > 0) {
      return weeklyTrend;
    }
    return [
      { label: 'Tuần 1', rate: overallAttendanceRate, lateRate: Math.max(0, 100 - overallAttendanceRate) },
      { label: 'Tuần 2', rate: overallAttendanceRate, lateRate: Math.max(0, 100 - overallAttendanceRate) },
      { label: 'Tuần 3', rate: overallAttendanceRate, lateRate: Math.max(0, 100 - overallAttendanceRate) },
      { label: 'Tuần 4', rate: overallAttendanceRate, lateRate: Math.max(0, 100 - overallAttendanceRate) },
    ];
  }, [weeklyTrend, overallAttendanceRate]);

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

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              Thống Kê Chấm Công & Báo Cáo
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">Giám sát chuyên cần theo tháng</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Báo Cáo Chấm Công Tháng {selectedMonth}/{selectedYear}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xem nhanh tỷ lệ chuyên cần, các trường hợp đi muộn, vắng mặt và chi tiết theo từng giảng viên.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month / Year */}
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

          {/* Toggle Guide */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ${
              showGuide
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
            }`}
            title="Bật/Tắt hướng dẫn giải thích chỉ số thống kê"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showGuide ? 'Ẩn giải thích' : '💡 Giải thích chỉ số'}</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handlePrintPdf}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In PDF</span>
          </button>
        </div>
      </div>

      {/* Explanations Panel (Giải thích dễ hiểu các chỉ số) */}
      {showGuide && (
        <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-white rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-sm transition-all print:hidden">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Info className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Hướng Dẫn & Ý Nghĩa Các Chỉ Số Thống Kê
              </h3>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <span>Thu gọn</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* 1. Đúng giờ */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
              <div>
                <p className="font-bold text-emerald-800">Đúng giờ (On-Time)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Cán bộ/giảng viên quét mã vào lớp đúng giờ quy định (hoặc trong 15 phút đầu cho phép). Được tính 100% công giảng dạy.
                </p>
              </div>
            </div>

            {/* 2. Đi muộn */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
              <div>
                <p className="font-bold text-amber-800">Đi muộn (Late)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Quét mã vào lớp sau giờ bắt đầu ca học quá 15 phút. Hệ thống tự động ghi nhận phút muộn để phòng Thanh tra theo dõi.
                </p>
              </div>
            </div>

            {/* 3. Về sớm */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-1 shrink-0"></span>
              <div>
                <p className="font-bold text-orange-800">Về sớm (Early Leave)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Quét mã kết thúc ca trước thời điểm hết giờ ca dạy mà chưa có sự đồng ý của quản lý bộ môn.
                </p>
              </div>
            </div>

            {/* 4. Vắng không phép */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0"></span>
              <div>
                <p className="font-bold text-rose-800">Vắng không phép (Absent)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Ca dạy trong thời khóa biểu đã qua nhưng không có điểm danh và không có đơn xin nghỉ phép. Cần yêu cầu nộp đơn giải trình.
                </p>
              </div>
            </div>

            {/* 5. Nghỉ có phép */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0"></span>
              <div>
                <p className="font-bold text-blue-800">Nghỉ có phép (Excused)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Đã làm đơn xin nghỉ (hoặc đăng ký dạy bù) và được Ban Quản trị / Trưởng khoa duyệt. Ca nghỉ được bảo lưu quyền lợi hợp lệ.
                </p>
              </div>
            </div>

            {/* 6. Công thức Chuyên cần */}
            <div className="bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-xs flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1 shrink-0"></span>
              <div>
                <p className="font-bold text-indigo-900">Tỷ lệ Chuyên cần (%)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  <span className="font-semibold text-slate-800">= (Đúng giờ + Nghỉ có phép) ÷ Tổng ca × 100%</span>.
                  Xếp loại: <span className="text-emerald-700 font-bold">≥ 90% Tốt</span> • <span className="text-amber-700 font-bold">75-89% Khá</span> • <span className="text-rose-700 font-bold">&lt; 75% Chấn chỉnh</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Overview Cards - Bố cục gọn gàng, trực quan */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card 1: Tổng thể chuyên cần (Highlight Card - 5 cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-300" />
              Tỷ Lệ Chuyên Cần Tháng {selectedMonth}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                !hasRecords
                  ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  : overallAttendanceRate! >= 90
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : overallAttendanceRate! >= 75
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {!hasRecords
                ? 'Chưa có dữ liệu'
                : overallAttendanceRate! >= 90
                ? 'Xếp loại: Tốt'
                : overallAttendanceRate! >= 75
                ? 'Xếp loại: Khá'
                : 'Cần nhắc nhở'}
            </span>
          </div>

          <div className="my-4 flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono">
              {hasRecords ? `${overallAttendanceRate}%` : 'N/A'}
            </span>
            <div className="text-xs text-blue-200">
              <p className="font-semibold">{validShifts} / {totalShifts} ca hợp lệ</p>
              <p className="text-[11px] text-blue-300/80">(Bao gồm Đúng giờ & Nghỉ có phép)</p>
            </div>
          </div>

          {/* Thanh tiến độ */}
          <div className="space-y-1.5">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  !hasRecords
                    ? 'bg-slate-500'
                    : overallAttendanceRate! >= 90
                    ? 'bg-emerald-400'
                    : overallAttendanceRate! >= 75
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${hasRecords ? Math.min(100, overallAttendanceRate!) : 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-blue-300/80">
              <span>Mục tiêu trường: ≥ 90%</span>
              <span>Tổng số lượt chấm công: {totalShifts}</span>
            </div>
          </div>
        </div>

        {/* Nhóm 5 Card chi tiết (7 cols) */}
        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Đúng giờ */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800">Đúng giờ</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-2 font-mono">{onTimeShifts}</p>
            <span className="text-[10px] text-slate-400 mt-0.5">Ca hoàn thành tốt</span>
          </div>

          {/* Đi muộn */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800">Đi muộn</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-700 mt-2 font-mono">{lateShifts}</p>
            <span className="text-[10px] text-slate-400 mt-0.5">Quá giờ quy định</span>
          </div>

          {/* Về sớm */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-800">Về sớm</span>
              <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-orange-700 mt-2 font-mono">{earlyLeaveShifts}</p>
            <span className="text-[10px] text-slate-400 mt-0.5">Trước giờ kết thúc</span>
          </div>

          {/* Vắng không phép */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800">Vắng không phép</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <UserX className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-700 mt-2 font-mono">{absentShifts}</p>
            <span className="text-[10px] text-rose-600 font-semibold mt-0.5">Cần giải trình</span>
          </div>

          {/* Nghỉ có phép */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-800">Nghỉ có phép (Hợp lệ)</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-2xl font-black text-blue-700 font-mono">{excusedShifts}</p>
              <span className="text-xs text-slate-500 font-normal">ca nghỉ</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-blue-600 font-semibold font-mono">
                Đã duyệt: {summary?.approvedLeaveDays ?? 0} ngày
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">Đơn đã được phê duyệt chính thức</span>
          </div>
        </div>
      </div>

      {/* 3 Interactive Charts Grid */}
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
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Bảng Tổng Hợp Công Tác Chi Tiết Theo Cán Bộ / Giảng Viên (Tháng {selectedMonth}/{selectedYear})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hiển thị {filteredStaffList.length} / {staffList.length} nhân sự
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64 print:hidden">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, email, vai trò..."
              className="w-full pl-8 pr-3 py-1.5 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
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
              ) : filteredStaffList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    {searchTerm ? 'Không tìm thấy nhân sự phù hợp với từ khóa.' : 'Không có dữ liệu nhân sự trong tháng này.'}
                  </td>
                </tr>
              ) : (
                paginatedStaffList.map((item, idx) => {
                  const hasShifts = item.totalWorkingDays > 0;
                  const onTimeRate = hasShifts
                    ? Math.round(((item.onTimeCount + item.excusedCount) / item.totalWorkingDays) * 100)
                    : null;

                  return (
                    <tr key={item.user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono">{(currentPage - 1) * pageSize + idx + 1}</td>
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
                            !hasShifts
                              ? 'bg-slate-100 text-slate-500'
                              : onTimeRate! >= 90
                              ? 'bg-emerald-50 text-emerald-700'
                              : onTimeRate! >= 75
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {hasShifts ? `${onTimeRate}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang danh sách nhân sự */}
        {filteredStaffList.length > pageSize && (
          <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 print:hidden">
            <div>
              Hiển thị <span className="font-semibold text-slate-700 font-mono">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-slate-700 font-mono">{Math.min(currentPage * pageSize, filteredStaffList.length)}</span> trên tổng số <span className="font-semibold text-slate-700 font-mono">{filteredStaffList.length}</span> nhân sự
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium transition flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>
              <span className="px-2 font-semibold text-slate-700 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium transition flex items-center gap-1 shadow-2xs"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
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
