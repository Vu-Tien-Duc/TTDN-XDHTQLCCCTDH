import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  Hourglass,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import leaveService, { LeaveBalanceData } from '../../services/leave.service';
import { useAuth } from '../../contexts/AuthContext';

interface LeaveBalanceCardProps {
  userId?: string;
  refreshTrigger?: number;
  className?: string;
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({
  userId,
  refreshTrigger = 0,
  className = '',
}) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<LeaveBalanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchBalance = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await leaveService.getLeaveBalance(userId);
        if (isMounted && res.success && res.data) {
          setBalance(res.data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Không thể tải thông tin quỹ phép';
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchBalance();
    return () => {
      isMounted = false;
    };
  }, [userId, refreshTrigger]);

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm animate-pulse ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 bg-slate-200 rounded-lg w-1/3"></div>
          <div className="h-5 bg-slate-100 rounded-full w-24"></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="h-20 bg-slate-100 rounded-2xl"></div>
          <div className="h-20 bg-slate-100 rounded-2xl"></div>
          <div className="h-20 bg-slate-100 rounded-2xl"></div>
          <div className="h-20 bg-slate-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Nếu là Quản trị viên (Admin)
  if (user?.role === 'admin' || balance?.isAdmin) {
    return (
      <div className={`bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-md border border-indigo-800/40 relative overflow-hidden ${className}`}>
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold border border-indigo-400/20 mb-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Đặc Quyền Quản Trị Viên (Admin)
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">Quyền Hạn Phê Duyệt Toàn Trường</h3>
              <p className="text-xs text-indigo-200/80 mt-0.5 max-w-xl">
                Tài khoản Quản trị viên giữ thẩm quyền phê duyệt tối cao, không áp dụng hạn mức 12 ngày phép năm cá nhân.
              </p>
            </div>
          </div>

          <Link
            to="/leave/approvals"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-600/20"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Đến Hộp Duyệt Đơn</span>
          </Link>
        </div>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className={`bg-amber-50 rounded-2xl border border-amber-200 p-4 text-amber-800 text-xs flex items-center gap-2.5 ${className}`}>
        <Info className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Chưa có dữ liệu quỹ phép cho năm hiện tại. Vui lòng liên hệ phòng Quản trị Nhân sự.</span>
      </div>
    );
  }

  const quota = balance.annualLeaveQuota || 12;
  const used = balance.daysUsed || 0;
  const pending = balance.pendingDays || 0;
  const remaining = balance.remainingDays !== undefined ? balance.remainingDays : Math.max(0, quota - used);

  // Tính phần trăm các phân đoạn
  const usedPercent = Math.min(100, Math.round((used / quota) * 100));
  const pendingPercent = Math.min(100 - usedPercent, Math.round((pending / quota) * 100));
  const remainingPercent = Math.max(0, 100 - usedPercent - pendingPercent);

  const isLowRemaining = remaining <= 2 && remaining > 0;
  const isZeroRemaining = remaining <= 0;

  return (
    <div className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${className}`}>
      {/* Background soft ambient accents */}
      <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-0 -translate-x-12 translate-y-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Quỹ Ngày Phép Năm {balance.year}
              </h3>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                Hưởng Lương
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động tính toán & khấu trừ từ các đơn nghỉ đã duyệt trong năm
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Hourglass className="w-3 h-3 animate-pulse text-indigo-600" />
              Đang chờ duyệt: <strong>{pending} ngày</strong>
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
              usedPercent >= 80
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : usedPercent >= 50
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            Đã dùng {usedPercent}% quỹ phép
          </span>
        </div>
      </div>

      {/* Responsive Metrics Display: 1 Hero Card + 3 Companion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-5 relative z-10">
        {/* 1. HERO METRIC: CÒN LẠI KHẢ DỤNG */}
        <div
          className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between sm:col-span-2 lg:col-span-1 ${
            isZeroRemaining
              ? 'bg-rose-50/70 border-rose-300 shadow-sm'
              : isLowRemaining
              ? 'bg-amber-50/70 border-amber-300 shadow-sm'
              : 'bg-gradient-to-br from-emerald-50/90 via-emerald-50/40 to-white border-emerald-300/80 shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Còn Lại Khả Dụng
              </p>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className={`text-3xl sm:text-4xl font-black tracking-tight ${
                  isZeroRemaining
                    ? 'text-rose-600'
                    : isLowRemaining
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {remaining}
              </span>
              <span className="text-xs font-bold text-slate-500">/ {quota} ngày</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {isZeroRemaining
                ? 'Đã sử dụng hết hạn mức'
                : isLowRemaining
                ? 'Sắp hết ngày phép năm'
                : 'Sẵn sàng áp dụng cho đơn mới'}
            </p>
          </div>

          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isZeroRemaining
                ? 'bg-rose-100 text-rose-700'
                : isLowRemaining
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* 2. Tổng Hạn Mức Năm */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tổng Hạn Mức
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{quota}</p>
            <p className="text-[11px] text-slate-400 font-medium">ngày phép năm 2026</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Đã Sử Dụng (APPROVED) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Đã Sử Dụng
            </p>
            <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{used}</p>
            <p className="text-[11px] text-amber-600 font-medium">ngày đã duyệt</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Đang Chờ Duyệt (PENDING) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/70 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider">
              Đang Chờ Duyệt
            </p>
            <p className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">{pending}</p>
            <p className="text-[11px] text-indigo-600 font-medium">ngày đang xét duyệt</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Progress Bar (3 Phân đoạn trực quan) */}
      <div className="space-y-2 relative z-10 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span>Phân bổ quỹ ngày phép:</span>
          <span className="font-mono text-[11px]">
            Đã duyệt {used}d + Chờ {pending}d + Còn {remaining}d = <strong>{quota} ngày</strong>
          </span>
        </div>

        {/* 3-Color Segmented Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {/* Segment 1: Used (Amber) */}
          {usedPercent > 0 && (
            <div
              className="h-full bg-amber-500 transition-all duration-500 relative group"
              style={{ width: `${usedPercent}%` }}
              title={`Đã duyệt: ${used} ngày (${usedPercent}%)`}
            />
          )}
          {/* Segment 2: Pending (Indigo) */}
          {pendingPercent > 0 && (
            <div
              className="h-full bg-indigo-500 transition-all duration-500 relative group"
              style={{ width: `${pendingPercent}%` }}
              title={`Chờ duyệt: ${pending} ngày (${pendingPercent}%)`}
            />
          )}
          {/* Segment 3: Remaining (Emerald) */}
          {remainingPercent > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-500 relative group"
              style={{ width: `${remainingPercent}%` }}
              title={`Còn lại: ${remaining} ngày (${remainingPercent}%)`}
            />
          )}
        </div>

        {/* Segment Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
            <span>Đã dùng: <strong>{used} ngày</strong> ({usedPercent}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
            <span>Chờ duyệt: <strong>{pending} ngày</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Khả dụng: <strong className="text-emerald-700">{remaining} ngày</strong></span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {isZeroRemaining && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            Bạn đã sử dụng hết <strong>{quota} ngày phép năm</strong>. Nếu tiếp tục nghỉ, vui lòng chọn hình thức <strong>"Đăng ký dạy bù"</strong> hoặc <strong>"Xin đổi ca dạy"</strong>.
          </span>
        </div>
      )}

      {isLowRemaining && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Lưu ý: Quỹ ngày phép năm của bạn chỉ còn lại <strong>{remaining} ngày</strong>. Hãy cân nhắc kế hoạch công tác.
          </span>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceCard;
