import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Clock, Info, ShieldAlert } from 'lucide-react';
import leaveService, { LeaveBalanceData } from '../../services/leave.service';

interface LeaveBalanceCardProps {
  userId?: string;
  refreshTrigger?: number;
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({ userId, refreshTrigger = 0 }) => {
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-amber-800 text-xs flex items-center gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Chưa có dữ liệu hạn mức phép cho năm hiện tại.</span>
      </div>
    );
  }

  const quota = balance.annualLeaveQuota || 12;
  const used = balance.daysUsed || 0;
  const remaining = balance.remainingDays !== undefined ? balance.remainingDays : Math.max(0, quota - used);
  const usedPercent = Math.min(100, Math.round((used / quota) * 100));

  // Màu thanh tiến độ
  let progressColor = 'bg-emerald-500';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (usedPercent >= 80) {
    progressColor = 'bg-rose-500';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (usedPercent >= 50) {
    progressColor = 'bg-amber-500';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-blue-50 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Quỹ Ngày Phép Năm {balance.year}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tính toán tự động theo thời gian thực từ các đơn nghỉ đã duyệt trong năm
          </p>
        </div>

        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>
          Đã dùng {usedPercent}% quỹ phép
        </span>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 relative z-10">
        {/* Total Quota */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Tổng hạn mức</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{quota}</p>
            <p className="text-[11px] text-slate-400">ngày / năm</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100/70 text-blue-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Days Used */}
        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-800">Đã sử dụng</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-0.5">{used}</p>
            <p className="text-[11px] text-amber-600">ngày thực nghỉ</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Remaining Days */}
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-800">Còn lại</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">{remaining}</p>
            <p className="text-[11px] text-emerald-600">ngày khả dụng</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 relative z-10">
        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>Tiến độ sử dụng</span>
          <span>{used} / {quota} ngày</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
            style={{ width: `${usedPercent}%` }}
          ></div>
        </div>
      </div>

      {remaining <= 2 && remaining > 0 && (
        <div className="mt-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Bạn chỉ còn lại <strong>{remaining} ngày phép</strong> trong năm nay.</span>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceCard;
