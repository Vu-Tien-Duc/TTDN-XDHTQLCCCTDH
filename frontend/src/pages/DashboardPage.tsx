import React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../utils';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const role = user?.role || 'giangvien';

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-100 text-xs font-semibold mb-3">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Cổng Thông Tin Giảng Viên & Cán Bộ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Xin chào, {user?.fullName || 'Cán bộ'}!
            </h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Hệ thống đã sẵn sàng phục vụ công tác điểm danh, quản lý ca giảng dạy và giải quyết các thủ tục nghỉ phép điện tử.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2">
            <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
              <p className="text-xs text-blue-200">Vai trò đăng nhập</p>
              <p className="text-sm font-bold text-white">{ROLE_LABELS[role]}</p>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
              <p className="text-xs text-blue-200">Quỹ nghỉ phép năm</p>
              <p className="text-sm font-bold text-white">
                {user?.annualLeaveQuota || 12} ngày phép / năm
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chấm công hôm nay</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">ĐÚNG GIỜ</p>
          <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Ca sáng lúc 07:05
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lịch trong tuần</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">6 Ca Dạy</p>
          <p className="text-xs text-slate-500 mt-1">Phân bổ Thứ 2 đến Thứ 6</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đơn từ xử lý</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">01 Đơn</p>
          <p className="text-xs text-amber-600 font-medium mt-1">1 đơn nghỉ phép đã duyệt</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái bảo mật</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">AN TOÀN</p>
          <p className="text-xs text-slate-500 mt-1">JWT + Cookie Auth Active</p>
        </div>
      </div>

      {/* 3. Quick Actions by Role */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
        <h3 className="text-base font-bold text-slate-900 mb-4">Thao tác nhanh cho {ROLE_LABELS[role]}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/attendance"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/70 hover:border-blue-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Điểm danh & Chấm công</h4>
              <p className="text-xs text-slate-500 mt-1">Ghi nhận giờ vào ra ca học hôm nay.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 mt-4">
              <span>Thực hiện ngay</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/leave-requests"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {role === 'admin' || role === 'truongkhoa' ? 'Phê duyệt đơn từ' : 'Làm đơn xin phép'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {role === 'admin' || role === 'truongkhoa'
                  ? 'Xem danh sách và xét duyệt đơn của giảng viên.'
                  : 'Gửi đơn xin nghỉ phép, dạy bù hoặc đổi ca.'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 mt-4">
              <span>Xem chi tiết</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/schedules"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/70 hover:border-emerald-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <CalendarDays className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Thời khóa biểu giảng dạy</h4>
              <p className="text-xs text-slate-500 mt-1">Tra cứu phân công môn học, phòng học theo tuần.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-4">
              <span>Xem lịch</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* 4. Admin / Dean Quick Insights (nếu là Admin hoặc Trưởng khoa) */}
      {(role === 'admin' || role === 'truongkhoa') && (
        <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-bold">Thống kê Quản lý Phân quyền ({ROLE_LABELS[role]})</h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">MongoDB ODM Active</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
              <p className="text-xs text-slate-400">Khoa / Bộ môn</p>
              <p className="text-lg font-bold text-blue-400 mt-1">6 Đơn vị</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
              <p className="text-xs text-slate-400">Cán bộ & Giảng viên</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">6 Tài khoản</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
              <p className="text-xs text-slate-400">Ca làm việc chuẩn</p>
              <p className="text-lg font-bold text-indigo-400 mt-1">3 Ca (Sáng, Chiều, Tối)</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
              <p className="text-xs text-slate-400">Collections CSDL</p>
              <p className="text-lg font-bold text-amber-400 mt-1">9 Collections</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
