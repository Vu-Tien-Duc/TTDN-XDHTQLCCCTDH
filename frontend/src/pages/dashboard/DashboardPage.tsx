import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Users,
  Sparkles,
  MapPin,
  ExternalLink,
  FileCheck2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  LogOut,
  Navigation,
  QrCode,
  Camera,
  Monitor,
  Hand,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ROLE_LABELS,
  ATTENDANCE_STATUS_MAP,
  LEAVE_STATUS_MAP,
  formatDate,
  formatTime,
  getVietnamDateString,
} from '../../utils';
import {
  User,
  Schedule,
  AttendanceLog,
  LeaveRequest,
  ShiftConfig,
} from '../../types';
import {
  scheduleService,
  leaveService,
  reportService,
  attendanceService,
  userService,
  departmentService,
  AttendanceReportData,
  LeaveBalanceData,
} from '../../services';
import { Button, Modal, EmptyState } from '../../components';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBgClass?: string;
  iconColorClass?: string;
  loading?: boolean;
  action?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgClass = 'bg-blue-50',
  iconColorClass = 'text-blue-600',
  loading = false,
  action,
}) => {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass} ${iconColorClass}`}
          >
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>

        {loading ? (
          <div className="h-8 bg-slate-100 animate-pulse rounded-lg mt-3 w-28" />
        ) : (
          <div className="mt-2.5 flex items-baseline gap-2">
            {typeof value === 'string' || typeof value === 'number' ? (
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {value}
              </span>
            ) : (
              value
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
        <div className="truncate flex-1">{subtitle}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
};

interface DashboardSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass?: string;
  iconBgClass?: string;
  action?: React.ReactNode;
}

const DashboardSectionHeader: React.FC<DashboardSectionHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconColorClass = 'text-blue-600',
  iconBgClass = 'bg-blue-50',
  action,
}) => {
  return (
    <div className="flex items-center justify-between mb-4 gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl ${iconBgClass} ${iconColorClass} flex items-center justify-center font-bold shrink-0`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'giangvien';
  const isAdminOrDean = role === 'admin' || role === 'truongkhoa';

  // -------------------------------------------------------------
  // Data State
  // -------------------------------------------------------------
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Schedules
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [totalScheduleCount, setTotalScheduleCount] = useState<number>(0);

  // Attendance
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [reportStats, setReportStats] = useState<AttendanceReportData | null>(null);

  // Leave Requests & Balance
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
  const [totalPendingLeavesCount, setTotalPendingLeavesCount] = useState<number>(0);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [myRecentLeaves, setMyRecentLeaves] = useState<LeaveRequest[]>([]);

  // Admin / Dean metrics
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [totalDeptsCount, setTotalDeptsCount] = useState<number>(0);

  // Widget Block Error Tracking
  const [blockErrors, setBlockErrors] = useState<{
    schedules?: boolean;
    attendance?: boolean;
    report?: boolean;
    leaves?: boolean;
    metrics?: boolean;
  }>({});

  // Quick Check-in & Check-out Modal/Action
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState<boolean>(false);
  const [checkinSubmitting, setCheckinSubmitting] = useState<boolean>(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');

  // -------------------------------------------------------------
  // Load All Real Data from APIs
  // -------------------------------------------------------------
  const fetchAllDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    const newErrors: {
      schedules?: boolean;
      attendance?: boolean;
      report?: boolean;
      leaves?: boolean;
      metrics?: boolean;
    } = {};

    try {
      const todayStr = getVietnamDateString();
      const [vYear, vMonth] = todayStr.split('-').map(Number);
      const firstDayOfMonth = `${vYear}-${String(vMonth).padStart(2, '0')}-01`;
      const lastDayNum = new Date(vYear, vMonth, 0).getDate();
      const lastDayOfMonth = `${vYear}-${String(vMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      const currentUserId = user?._id;

      // 1. Fetch Today Schedules & All Schedules
      const [todaySchedRes, allSchedRes] = await Promise.allSettled([
        scheduleService.getTodaySchedules({ date: todayStr }),
        scheduleService.getSchedules({ page: 1, limit: 1 }),
      ]);

      if (todaySchedRes.status === 'fulfilled' && todaySchedRes.value) {
        const rawSchedules = todaySchedRes.value.schedules || [];
        const sorted = [...rawSchedules].sort((a, b) => {
          const timeA =
            a.startTime || (typeof a.shiftId === 'object' && a.shiftId ? a.shiftId.startTime : '') || '00:00';
          const timeB =
            b.startTime || (typeof b.shiftId === 'object' && b.shiftId ? b.shiftId.startTime : '') || '00:00';
          return timeA.localeCompare(timeB);
        });
        setTodaySchedules(sorted);
      } else {
        newErrors.schedules = true;
      }

      if (allSchedRes.status === 'fulfilled' && allSchedRes.value) {
        const schedData = allSchedRes.value as { total?: number } | Schedule[];
        const totalCount =
          'total' in schedData && typeof schedData.total === 'number'
            ? schedData.total
            : Array.isArray(schedData)
            ? schedData.length
            : 0;
        setTotalScheduleCount(totalCount);
      }

      // 2. Fetch Attendance History & Today Logs for Current User
      const [historyRes, todayLogsRes] = await Promise.allSettled([
        attendanceService.getAttendanceHistory({ limit: 10 }),
        attendanceService.getAttendanceHistory({
          userId: currentUserId,
          from: todayStr,
          to: todayStr,
          limit: 50,
        }),
      ]);

      if (historyRes.status === 'fulfilled' && historyRes.value?.records) {
        setRecentLogs(historyRes.value.records.slice(0, 8));
      }

      let userTodayLogs: AttendanceLog[] = [];
      if (todayLogsRes.status === 'fulfilled' && todayLogsRes.value?.records) {
        userTodayLogs = todayLogsRes.value.records.filter((log) => {
          if (!log.checkInTime && !log.date) return false;
          const logDate = new Date(log.checkInTime || log.date);
          const logDateStr = getVietnamDateString(logDate);
          const logUserId =
            typeof log.userId === 'object' && log.userId !== null
              ? (log.userId as { _id?: string })._id
              : log.userId;
          if (currentUserId && logUserId && logUserId.toString() !== currentUserId.toString()) {
            return false;
          }
          return logDateStr === todayStr;
        });
      } else if (historyRes.status === 'fulfilled' && historyRes.value?.records) {
        userTodayLogs = historyRes.value.records.filter((log) => {
          if (!log.checkInTime && !log.date) return false;
          const logDate = new Date(log.checkInTime || log.date);
          const logDateStr = getVietnamDateString(logDate);
          const logUserId =
            typeof log.userId === 'object' && log.userId !== null
              ? (log.userId as { _id?: string })._id
              : log.userId;
          if (currentUserId && logUserId && logUserId.toString() !== currentUserId.toString()) {
            return false;
          }
          return logDateStr === todayStr;
        });
      } else {
        newErrors.attendance = true;
      }

      setTodayLogs(userTodayLogs);

      // 3. Fetch General Attendance Report cho tháng hiện tại
      const reportRes = await reportService
        .getAttendanceReport({ from: firstDayOfMonth, to: lastDayOfMonth })
        .catch(() => {
          newErrors.report = true;
          return null;
        });
      if (reportRes?.success && reportRes.data) {
        setReportStats(reportRes.data);
      }

      // 4. Fetch Leave Balance & Leave Requests
      const [balanceRes, leavesRes] = await Promise.allSettled([
        role === 'admin' ? Promise.resolve(null) : leaveService.getLeaveBalance(),
        leaveService.getLeaveRequests(isAdminOrDean ? { status: 'PENDING' } : undefined),
      ]);

      if (balanceRes.status === 'fulfilled' && balanceRes.value?.success && balanceRes.value.data) {
        setLeaveBalance(balanceRes.value.data);
      }

      if (leavesRes.status === 'fulfilled' && leavesRes.value?.success && leavesRes.value.data) {
        const leaves = leavesRes.value.data;
        if (isAdminOrDean) {
          const allPending = leaves.filter((l) => l.status === 'PENDING');
          setTotalPendingLeavesCount(allPending.length);
          setPendingLeaves(allPending.slice(0, 4));
        } else {
          setMyRecentLeaves(leaves.slice(0, 4));
        }
      } else {
        newErrors.leaves = true;
      }

      // 5. Admin / Dean Extra Metrics
      if (isAdminOrDean) {
        const [usersRes, deptsRes] = await Promise.allSettled([
          userService.getUsers({ page: 1, limit: 1 }),
          departmentService.getDepartments(),
        ]);

        if (usersRes.status === 'fulfilled' && usersRes.value) {
          const uVal = usersRes.value as { total?: number } | User[];
          const totalU =
            'total' in uVal && typeof uVal.total === 'number'
              ? uVal.total
              : Array.isArray(uVal)
              ? uVal.length
              : 0;
          setTotalUsersCount(totalU);
        }
        if (deptsRes.status === 'fulfilled' && deptsRes.value) {
          setTotalDeptsCount(Array.isArray(deptsRes.value) ? deptsRes.value.length : 0);
        }
      }

      setBlockErrors(newErrors);
    } catch {
      toast.error('Không thể đồng bộ toàn bộ dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdminOrDean, role, user?._id]);

  useEffect(() => {
    fetchAllDashboardData();
  }, [fetchAllDashboardData]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleRefresh = () => {
    fetchAllDashboardData(true);
    toast.success('Dữ liệu đã được cập nhật mới nhất!', { icon: '🔄' });
  };

  const handleQuickCheckInSubmit = async () => {
    if (todaySchedules.length === 0) {
      toast.error('Hôm nay bạn không có ca phân công nào để điểm danh.');
      return;
    }
    setCheckinSubmitting(true);
    try {
      const payload: { scheduleId?: string; shiftId?: string } = {};
      if (selectedScheduleId) {
        payload.scheduleId = selectedScheduleId;
        const matched = todaySchedules.find((s) => s._id === selectedScheduleId);
        if (matched?.shiftId) {
          payload.shiftId = typeof matched.shiftId === 'object' ? matched.shiftId._id : matched.shiftId;
        }
      }

      await attendanceService.checkIn(payload);
      toast.success('Điểm danh thành công! Trạng thái đã được ghi nhận.', { icon: '✅' });
      setIsCheckInModalOpen(false);
      fetchAllDashboardData(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        axiosErr?.response?.data?.message || axiosErr?.message || 'Điểm danh thất bại. Vui lòng thử lại sau.';
      toast.error(errMsg);
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const handleCheckOut = async (attendanceId?: string) => {
    setCheckingOutId(attendanceId || 'default');
    try {
      await attendanceService.checkOut({
        attendanceId,
      });
      toast.success('Ghi nhận ra ca (Check-out) thành công!', { icon: '🚪' });
      fetchAllDashboardData(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        axiosErr?.response?.data?.message || axiosErr?.message || 'Check-out thất bại. Vui lòng thử lại sau.';
      toast.error(errMsg);
    } finally {
      setCheckingOutId(null);
    }
  };

  // -------------------------------------------------------------
  // Map Attendance Logs to Schedules
  // -------------------------------------------------------------
  const scheduleAttendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceLog>();

    const getScheduleIdFromLog = (log: AttendanceLog): string | null => {
      if (!log.scheduleId) return null;
      return typeof log.scheduleId === 'object' ? (log.scheduleId as { _id: string })._id : String(log.scheduleId);
    };

    const getShiftIdFromLog = (log: AttendanceLog): string | null => {
      if (!log.shiftId) return null;
      return typeof log.shiftId === 'object' ? (log.shiftId as { _id: string })._id : String(log.shiftId);
    };

    const getShiftIdFromSchedule = (s: Schedule): string | null => {
      if (!s.shiftId) return null;
      return typeof s.shiftId === 'object' ? (s.shiftId as { _id: string })._id : String(s.shiftId);
    };

    const usedLogIds = new Set<string>();

    const shiftFrequency = new Map<string, number>();
    todaySchedules.forEach((s) => {
      const sId = getShiftIdFromSchedule(s);
      if (sId) {
        shiftFrequency.set(sId, (shiftFrequency.get(sId) || 0) + 1);
      }
    });

    // 1. Ưu tiên ghép chính xác theo scheduleId
    todaySchedules.forEach((s) => {
      const matched = todayLogs.find((log) => {
        if (usedLogIds.has(log._id)) return false;
        const logSchedId = getScheduleIdFromLog(log);
        return logSchedId && logSchedId === s._id;
      });
      if (matched) {
        map.set(s._id, matched);
        usedLogIds.add(matched._id);
      }
    });

    // 2. Fallback theo shiftId nếu ca là duy nhất trong ngày
    todaySchedules.forEach((s) => {
      if (map.has(s._id)) return;
      const targetShiftId = getShiftIdFromSchedule(s);
      if (!targetShiftId || (shiftFrequency.get(targetShiftId) || 0) > 1) return;

      const matched = todayLogs.find((log) => {
        if (usedLogIds.has(log._id)) return false;
        const logShiftId = getShiftIdFromLog(log);
        return logShiftId && logShiftId === targetShiftId;
      });
      if (matched) {
        map.set(s._id, matched);
        usedLogIds.add(matched._id);
      }
    });

    return map;
  }, [todaySchedules, todayLogs]);

  // Ca làm việc đang mở (đã check-in thực tế nhưng chưa check-out)
  const activeOpenLog = useMemo(() => {
    return todayLogs.find(
      (log) => log.checkInTime && !log.checkOutTime && log.status !== 'ABSENT' && log.status !== 'EXCUSED_ABSENCE'
    );
  }, [todayLogs]);

  // Ca tiếp theo chưa được điểm danh
  const nextUnattendedSchedule = useMemo(() => {
    return todaySchedules.find((s) => !scheduleAttendanceMap.has(s._id));
  }, [todaySchedules, scheduleAttendanceMap]);

  // Tất cả các ca hôm nay đã check-out hoặc đã hoàn tất
  const allSchedulesCompleted = useMemo(() => {
    if (todaySchedules.length === 0) return false;
    return todaySchedules.every((s) => {
      const log = scheduleAttendanceMap.get(s._id);
      return log && (log.checkOutTime || log.status === 'ABSENT' || log.status === 'EXCUSED_ABSENCE');
    });
  }, [todaySchedules, scheduleAttendanceMap]);

  // Helper calculations
  const totalAttRecords = reportStats?.totalRecords || 0;
  const onTimeCount = reportStats?.onTimeCount || 0;
  const lateCount = reportStats?.lateCount || 0;
  const absentCount = reportStats?.absentCount || 0;
  const onTimePercentage =
    totalAttRecords > 0 ? Math.round((onTimeCount / totalAttRecords) * 100) : 0;

  const departmentName =
    user?.departmentId && typeof user.departmentId === 'object' && 'name' in user.departmentId
      ? user.departmentId.name
      : 'Trường Đại học';

  const todayFormatted = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Render Method Badge Helper
  const renderMethodBadge = (log: AttendanceLog) => {
    if (log.method === 'face' || log.method === 'FACE_ID') {
      return (
        <span className="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-indigo-200">
          <Camera className="w-3 h-3 text-indigo-500" />
          <span>Face ID</span>
          {log.confidenceScore && (
            <span className="text-[10px] text-indigo-400">
              ({Math.round(log.confidenceScore * 100)}%)
            </span>
          )}
        </span>
      );
    }
    if (log.method === 'gps' || log.method === 'GPS') {
      return (
        <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-blue-200">
          <Navigation className="w-3 h-3 text-blue-500" />
          <span>GPS</span>
        </span>
      );
    }
    if (log.method === 'qr' || log.method === 'QR') {
      return (
        <span className="inline-flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-purple-200">
          <QrCode className="w-3 h-3 text-purple-500" />
          <span>Mã QR</span>
        </span>
      );
    }
    if (log.method === 'admin_override' || log.isManualOverride) {
      return (
        <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-rose-200">
          <ShieldCheck className="w-3 h-3 text-rose-500" />
          <span>Admin</span>
        </span>
      );
    }
    if (log.method === 'system' || log.status === 'ABSENT' || log.status === 'EXCUSED_ABSENCE' || !log.checkInTime) {
      return (
        <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-medium border border-slate-200">
          <Monitor className="w-3 h-3 text-slate-500" />
          <span>Hệ thống</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-blue-200">
        <Hand className="w-3 h-3 text-blue-500" />
        <span>Thủ công</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Cảnh báo lỗi đồng bộ dữ liệu nếu có khối API bị lỗi */}
      {Object.values(blockErrors).some(Boolean) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 sm:p-4 text-amber-900 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Một số phân vùng dữ liệu tạm thời chưa thể đồng bộ mới nhất từ máy chủ. Số liệu hiển thị có thể chưa đầy đủ.
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition shrink-0 ml-2"
          >
            Thử tải lại
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. COMPACT PROFESSIONAL DASHBOARD HEADER                      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Info */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>{departmentName}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="capitalize">{todayFormatted}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{ROLE_LABELS[role]}</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span>Xin chào, {user?.fullName || 'Cán bộ'}!</span>
            </h1>

            <p className="text-xs text-slate-500">
              Cổng thông tin quản lý chấm công & thời khóa biểu giảng dạy trực tuyến.
            </p>
          </div>

          {/* Right Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {role !== 'admin' && (
              <div className="hidden lg:flex flex-col items-end pr-3 border-r border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Quỹ phép năm</span>
                <span className="text-sm font-bold text-slate-800">
                  {leaveBalance ? `${leaveBalance.remainingDays} / ${leaveBalance.annualLeaveQuota} ngày` : `${user?.annualLeaveQuota || 12} ngày`}
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="text-xs font-medium text-slate-700 hover:bg-slate-50 border-slate-200 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </Button>

            <Link to="/ai-assistant">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                <span>Trợ lý AI</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. REAL-TIME KPI STATS CARDS (Uniform Height & Clear Metrics)  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Điểm danh hôm nay / Tỷ lệ đúng giờ */}
        <StatCard
          title={isAdminOrDean ? 'Tỷ Lệ Đúng Giờ Hệ Thống' : 'Chấm Công Hôm Nay'}
          icon={CheckCircle2}
          iconBgClass={
            (isAdminOrDean && onTimePercentage >= 85) || allSchedulesCompleted
              ? 'bg-emerald-50'
              : activeOpenLog
              ? 'bg-blue-50'
              : todaySchedules.length > 0 && !allSchedulesCompleted
              ? 'bg-amber-50'
              : 'bg-slate-100'
          }
          iconColorClass={
            (isAdminOrDean && onTimePercentage >= 85) || allSchedulesCompleted
              ? 'text-emerald-600'
              : activeOpenLog
              ? 'text-blue-600'
              : todaySchedules.length > 0 && !allSchedulesCompleted
              ? 'text-amber-600'
              : 'text-slate-500'
          }
          loading={loading}
          value={
            isAdminOrDean ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {totalAttRecords > 0 ? `${onTimePercentage}%` : '---'}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {totalAttRecords > 0 ? 'đúng giờ' : 'chưa có dữ liệu'}
                </span>
              </div>
            ) : todaySchedules.length === 0 ? (
              <span className="text-base font-semibold text-slate-600">Không có ca dạy</span>
            ) : activeOpenLog ? (
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-blue-600">Đang trong ca</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
            ) : allSchedulesCompleted ? (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-base font-bold">Đã hoàn thành</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-base font-bold">Chưa điểm danh</span>
              </div>
            )
          }
          subtitle={
            isAdminOrDean ? (
              <span className="flex items-center gap-1 text-slate-500">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">
                  {totalAttRecords > 0
                    ? `${onTimeCount} đúng giờ / ${totalAttRecords} tổng lượt`
                    : 'Tháng này chưa có lượt điểm danh'}
                </span>
              </span>
            ) : todaySchedules.length === 0 ? (
              <span>Hôm nay bạn không có lịch phân công</span>
            ) : activeOpenLog ? (
              <span className="flex items-center gap-1 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Vào ca: {formatTime(activeOpenLog.checkInTime)}</span>
              </span>
            ) : allSchedulesCompleted ? (
              <span>Đã check-out đủ {todaySchedules.length} ca</span>
            ) : (
              <span className="truncate">
                {nextUnattendedSchedule ? (
                  <span>
                    Ca tiếp: <strong className="text-slate-700">{nextUnattendedSchedule.startTime || '07:00'}</strong> (P.{nextUnattendedSchedule.roomId || 'A1'})
                  </span>
                ) : (
                  'Chưa ghi nhận ca nào'
                )}
              </span>
            )
          }
          action={
            !isAdminOrDean && activeOpenLog ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCheckOut(activeOpenLog._id)}
                isLoading={checkingOutId === activeOpenLog._id}
                className="h-8 py-0 px-2.5 text-xs rounded-lg border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold"
              >
                <LogOut className="w-3 h-3 mr-1 text-amber-600" />
                <span>Ra ca</span>
              </Button>
            ) : undefined
          }
        />

        {/* CARD 2: Ca dạy hôm nay & lịch học */}
        <StatCard
          title={isAdminOrDean ? 'Ca Dạy Diễn Ra Hôm Nay' : 'Lịch Trình Hôm Nay'}
          icon={CalendarDays}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          loading={loading}
          value={
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {todaySchedules.length}
              </span>
              <span className="text-sm font-normal text-slate-500">ca dạy</span>
            </div>
          }
          subtitle={
            todaySchedules.length > 0 ? (
              <span className="flex items-center gap-1 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">
                  Phòng {todaySchedules[0].roomId || 'A1'} ({todaySchedules[0].startTime || '07:00'} - {todaySchedules[0].endTime || '09:15'})
                </span>
              </span>
            ) : (
              <span>Không có lịch phân công</span>
            )
          }
          action={
            <Link
              to="/schedules"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>Xem lịch</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {/* CARD 3: Đơn xin nghỉ / Hộp duyệt đơn */}
        <StatCard
          title={isAdminOrDean ? 'Đơn Nghỉ Chờ Phê Duyệt' : 'Quỹ Phép Còn Lại'}
          icon={FileText}
          iconBgClass={isAdminOrDean && totalPendingLeavesCount > 0 ? 'bg-amber-50' : 'bg-indigo-50'}
          iconColorClass={isAdminOrDean && totalPendingLeavesCount > 0 ? 'text-amber-600' : 'text-indigo-600'}
          loading={loading}
          value={
            isAdminOrDean ? (
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                    totalPendingLeavesCount > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {totalPendingLeavesCount}
                </span>
                <span className="text-sm font-normal text-slate-500">đơn chờ</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {leaveBalance?.remainingDays ?? user?.annualLeaveQuota ?? 12}
                </span>
                <span className="text-sm font-normal text-slate-500">ngày còn lại</span>
              </div>
            )
          }
          subtitle={
            isAdminOrDean ? (
              totalPendingLeavesCount > 0 ? (
                <span className="text-amber-700 font-medium">Cần xử lý phê duyệt</span>
              ) : (
                <span>Tất cả đơn đã được xử lý</span>
              )
            ) : (
              <span>Đã dùng: {leaveBalance?.daysUsed || 0} / {leaveBalance?.annualLeaveQuota || user?.annualLeaveQuota || 12} ngày</span>
            )
          }
          action={
            isAdminOrDean ? (
              <Link
                to="/leave/approvals"
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                <span>Duyệt đơn</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                to="/leave/create"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>Tạo đơn</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )
          }
        />

        {/* CARD 4: Quy mô nhân sự / Thống kê cá nhân */}
        <StatCard
          title={
            role === 'admin'
              ? 'Quy Mô Nhân Sự'
              : role === 'truongkhoa'
              ? 'Nhân Sự Trong Khoa'
              : 'Thống Kê Cá Nhân'
          }
          icon={Users}
          iconBgClass="bg-purple-50"
          iconColorClass="text-purple-600"
          loading={loading}
          value={
            isAdminOrDean ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {totalUsersCount}
                </span>
                <span className="text-sm font-normal text-slate-500">cán bộ</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600">
                  {onTimeCount}
                </span>
                <span className="text-sm font-normal text-slate-500">buổi đúng giờ</span>
              </div>
            )
          }
          subtitle={
            isAdminOrDean ? (
              <span>{totalDeptsCount} đơn vị • {totalScheduleCount} lịch học kỳ</span>
            ) : (
              <span>Đi muộn: {lateCount} • Vắng: {absentCount}</span>
            )
          }
          action={
            <Link
              to="/reports"
              className="text-xs font-semibold text-purple-600 hover:underline flex items-center gap-0.5"
            >
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN SECTION: 2 COLUMNS (8 COLS LEFT, 4 COLS RIGHT)        */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ============================================================ */}
        {/* LEFT COLUMN (lg:col-span-8): SCHEDULES & RECENT LOGS         */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 space-y-5">
          {/* BLOCK 1: LỊCH GIẢNG DẠY HÔM NAY */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <DashboardSectionHeader
              title={isAdminOrDean ? 'Thời Khóa Biểu Giảng Dạy Trong Ngày' : 'Lịch Trình Giảng Dạy Hôm Nay'}
              subtitle="Các ca giảng dạy và công tác được phân công hôm nay"
              icon={Clock}
              iconBgClass="bg-blue-50"
              iconColorClass="text-blue-600"
              action={
                <Link
                  to="/schedules"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <span>Xem cả tuần</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              }
            />

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : todaySchedules.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Hôm nay không có lịch giảng dạy"
                description="Bạn không có ca dạy hoặc lịch công tác phân công trong ngày hôm nay. Hãy tra cứu lịch cả tuần để chuẩn bị."
                actionText="Xem thời khóa biểu tuần"
                onAction={() => navigate('/schedules')}
                className="py-8"
              />
            ) : (
              <div className="space-y-2.5">
                {todaySchedules.map((item, idx) => {
                  const shiftObj =
                    typeof item.shiftId === 'object' && item.shiftId !== null
                      ? (item.shiftId as ShiftConfig)
                      : null;
                  const lecturerName =
                    typeof item.userId === 'object' && item.userId !== null
                      ? (item.userId as { fullName?: string }).fullName
                      : 'Giảng viên';

                  const startTime = item.startTime || shiftObj?.startTime || '07:00';
                  const endTime = item.endTime || shiftObj?.endTime || '09:15';
                  const shiftName = shiftObj?.name || `Ca học ${idx + 1}`;
                  const log = scheduleAttendanceMap.get(item._id);

                  return (
                    <div
                      key={item._id || idx}
                      className="p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Giờ</span>
                          <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                            {startTime.slice(0, 5)}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {item.subjectName || item.note || 'Lớp học phần chính khóa'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                              {shiftName}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Phòng {item.roomId || 'A1'}</span>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{startTime} - {endTime}</span>
                            </span>
                            {isAdminOrDean && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="flex items-center gap-1 text-slate-700 truncate">
                                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{lecturerName}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action / Status for Schedule Item */}
                      {!isAdminOrDean && (
                        <div className="shrink-0 flex items-center justify-end sm:self-center">
                          {(() => {
                            if (!log) {
                              return (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setSelectedScheduleId(item._id);
                                    setIsCheckInModalOpen(true);
                                  }}
                                  className="h-8 py-0 px-3 text-xs rounded-lg font-semibold bg-blue-600 hover:bg-blue-700"
                                >
                                  Điểm danh
                                </Button>
                              );
                            }
                            if (log.status === 'ABSENT') {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Vắng mặt</span>
                                </span>
                              );
                            }
                            if (log.status === 'EXCUSED_ABSENCE') {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Nghỉ có phép</span>
                                </span>
                              );
                            }
                            if (!log.checkOutTime) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span>Vào: {formatTime(log.checkInTime)}</span>
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCheckOut(log._id)}
                                    isLoading={checkingOutId === log._id}
                                    className="h-8 py-0 px-2.5 text-xs rounded-lg border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold"
                                  >
                                    <LogOut className="w-3 h-3 mr-1 text-amber-600" />
                                    <span>Ra ca</span>
                                  </Button>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col sm:items-end gap-0.5">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Đã hoàn thành</span>
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {formatTime(log.checkInTime)} - {formatTime(log.checkOutTime)}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BLOCK 2: NHẬT KÝ CHẤM CÔNG GẦN NHẤT */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <DashboardSectionHeader
              title="Nhật Ký Chấm Công Gần Nhất"
              subtitle="Lịch sử quẹt thẻ, nhận diện khuôn mặt và chấm công"
              icon={CheckCircle2}
              iconBgClass="bg-emerald-50"
              iconColorClass="text-emerald-600"
              action={
                <Link
                  to="/attendance/history"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <span>Xem tất cả</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              }
            />

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentLogs.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Chưa có dữ liệu chấm công gần đây"
                description="Hệ thống chưa ghi nhận lượt chấm công nào trong khoảng thời gian này."
                className="py-8"
              />
            ) : (
              <>
                {/* 1. Mobile Card List (Hidden on sm and above) - Prevents Table Squishing / Horizontal Overflow */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {recentLogs.map((log) => {
                    const logUser =
                      typeof log.userId === 'object' && log.userId !== null
                        ? (log.userId as { fullName?: string; email?: string })
                        : null;
                    const statusInfo = ATTENDANCE_STATUS_MAP[log.status] || {
                      label: log.status,
                      color: 'text-slate-700',
                      bg: 'bg-slate-100',
                    };

                    return (
                      <div key={log._id} className="py-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-slate-900">
                            {formatDate(log.checkInTime || log.workDate || log.date || log.createdAt)}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${statusInfo.bg} ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        {isAdminOrDean && (
                          <div className="text-xs text-slate-700 font-medium truncate">
                            Cán bộ: <span className="font-semibold text-slate-900">{logUser?.fullName || 'N/A'}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-2 font-mono">
                            <span>Vào: <strong className="text-slate-800">{log.checkInTime ? formatTime(log.checkInTime) : '—'}</strong></span>
                            <span>→</span>
                            <span>Ra: <strong className="text-slate-800">{log.checkOutTime ? formatTime(log.checkOutTime) : '—'}</strong></span>
                          </div>
                          <div>{renderMethodBadge(log)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Desktop Table (Hidden on mobile) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                        <th className="pb-3 pr-4">Thời gian</th>
                        {isAdminOrDean && <th className="pb-3 px-4">Cán bộ</th>}
                        <th className="pb-3 px-4">Vào ca</th>
                        <th className="pb-3 px-4">Ra ca</th>
                        <th className="pb-3 px-4">Trạng thái</th>
                        <th className="pb-3 pl-4">Phương thức</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentLogs.map((log) => {
                        const logUser =
                          typeof log.userId === 'object' && log.userId !== null
                            ? (log.userId as { fullName?: string; email?: string })
                            : null;
                        const statusInfo = ATTENDANCE_STATUS_MAP[log.status] || {
                          label: log.status,
                          color: 'text-slate-700',
                          bg: 'bg-slate-100',
                        };

                        return (
                          <tr key={log._id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                              {formatDate(log.checkInTime || log.workDate || log.date || log.createdAt)}
                            </td>
                            {isAdminOrDean && (
                              <td className="py-3 px-4 font-medium text-slate-800 truncate max-w-[150px]">
                                {logUser?.fullName || 'Cán bộ'}
                              </td>
                            )}
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {log.status === 'ABSENT' || log.status === 'EXCUSED_ABSENCE' || !log.checkInTime
                                ? '—'
                                : formatTime(log.checkInTime)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {log.checkOutTime ? formatTime(log.checkOutTime) : '—'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] border ${statusInfo.bg} ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="py-3 pl-4 text-slate-600 font-medium whitespace-nowrap">
                              {renderMethodBadge(log)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN (lg:col-span-4): LEAVES, STATS, QUICK ACTIONS  */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-5">
          {/* WIDGET 1: HỘP DUYỆT ĐƠN CHO ADMIN & TRƯỞNG KHOA / ĐƠN CỦA TÔI */}
          {isAdminOrDean ? (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
              <DashboardSectionHeader
                title="Đơn Cần Phê Duyệt"
                subtitle="Đơn xin nghỉ phép, đổi ca chờ xử lý"
                icon={FileCheck2}
                iconBgClass="bg-amber-50"
                iconColorClass="text-amber-600"
                action={
                  <Link
                    to="/leave/approvals"
                    className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>Tất cả</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />

              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : pendingLeaves.length === 0 ? (
                <div className="p-5 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-700">Không có đơn chờ duyệt</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tất cả đơn nghỉ đã được giải quyết.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingLeaves.map((req) => {
                    const applicant =
                      typeof req.userId === 'object' && req.userId !== null
                        ? (req.userId as { fullName?: string; email?: string })
                        : null;

                    return (
                      <div
                        key={req._id}
                        className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/60 hover:bg-amber-50/70 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[160px]">
                            {applicant?.fullName || 'Giảng viên'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Chờ duyệt
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-1 italic">
                          "{req.reason || 'Xin nghỉ có việc riêng'}"
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/50 text-[11px] text-slate-500 font-medium">
                          <span>
                            {formatDate(req.startDate)} - {formatDate(req.endDate)}
                          </span>
                          <Link
                            to="/leave/approvals"
                            className="text-indigo-600 hover:underline font-bold text-xs"
                          >
                            Xử lý →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* WIDGET CHO GIẢNG VIÊN: ĐƠN CỦA TÔI */
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
              <DashboardSectionHeader
                title="Đơn Nghỉ Phép Của Bạn"
                subtitle="Tiến độ xét duyệt đơn gần đây"
                icon={FileText}
                iconBgClass="bg-indigo-50"
                iconColorClass="text-indigo-600"
                action={
                  <Link to="/leave/create" className="text-xs font-semibold text-blue-600 hover:underline">
                    + Tạo mới
                  </Link>
                }
              />

              {myRecentLeaves.length === 0 ? (
                <div className="p-5 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                  <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-700">Chưa có đơn từ nào</p>
                  <Link to="/leave/create">
                    <Button variant="outline" size="sm" className="mt-2 text-xs h-8">
                      Tạo đơn xin nghỉ
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {myRecentLeaves.map((leave) => {
                    const statusConfig = LEAVE_STATUS_MAP[leave.status] || {
                      label: leave.status,
                      color: 'text-slate-700',
                      bg: 'bg-slate-100',
                    };

                    return (
                      <div
                        key={leave._id}
                        className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/60 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 capitalize truncate">
                            {leave.leaveType === 'nghi_phep' ? 'Nghỉ phép thường niên' : leave.leaveType}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusConfig.bg} ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {formatDate(leave.startDate)} đến {formatDate(leave.endDate)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* WIDGET 2: TỔNG QUAN TỶ LỆ KỶ LUẬT CHUYÊN CẦN */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-0.5">Cơ Cấu Điểm Danh Tháng</h4>
            <p className="text-xs text-slate-500 mb-3.5">Tổng hợp tỷ lệ chấp hành giờ giảng dạy</p>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Đúng giờ
                  </span>
                  <span className="font-bold text-slate-900">{onTimeCount} lượt ({onTimePercentage}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${onTimePercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Đi muộn
                  </span>
                  <span className="font-bold text-slate-900">
                    {lateCount} lượt (
                    {totalAttRecords > 0 ? Math.round((lateCount / totalAttRecords) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${totalAttRecords > 0 ? (lateCount / totalAttRecords) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Vắng mặt
                  </span>
                  <span className="font-bold text-slate-900">
                    {absentCount} lượt (
                    {totalAttRecords > 0 ? Math.round((absentCount / totalAttRecords) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${totalAttRecords > 0 ? (absentCount / totalAttRecords) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Xem biểu đồ phân tích</span>
              <Link
                to="/reports"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                <span>Mở Báo Cáo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* WIDGET 3: LỐI TẮT THAO TÁC NHANH (Clean Professional Action Grid) */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-0.5 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Phím Tắt Nghiệp Vụ</span>
            </h4>
            <p className="text-xs text-slate-500 mb-3.5">Truy cập nhanh chức năng phổ biến</p>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/schedules"
                className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 transition text-center flex flex-col items-center justify-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center group-hover:scale-105 transition">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Thời Khóa Biểu</span>
              </Link>

              {role !== 'admin' && (
                <Link
                  to="/leave/create"
                  className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition text-center flex flex-col items-center justify-center gap-1.5 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100/70 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">Làm Đơn Nghỉ</span>
                </Link>
              )}

              <Link
                to={isAdminOrDean ? '/attendance' : '/attendance/check-in'}
                className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 transition text-center flex flex-col items-center justify-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Chấm Công</span>
              </Link>

              <Link
                to="/ai-assistant"
                className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200/80 hover:border-purple-200 transition text-center flex flex-col items-center justify-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100/70 text-purple-700 flex items-center justify-center group-hover:scale-105 transition">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800">Trợ Lý AI</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ATTENDANCE ACTION MODAL: CHẤM CÔNG THỰC TẾ                 */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        title="Chọn Hình Thức Điểm Danh Vào Ca"
        maxWidth="lg"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs leading-relaxed flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-blue-950 text-xs sm:text-sm">
                Thời gian ghi nhận thực tế: {new Date().toLocaleTimeString('vi-VN')}
              </p>
              <p className="text-slate-600 mt-0.5 text-xs">
                Hệ thống xác thực vị trí vệ tinh GPS trong khuôn viên trường hoặc đối soát mã QR / Face ID để đảm bảo tính minh bạch.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ca giảng dạy / công tác hôm nay:
            </label>
            {todaySchedules.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Hôm nay bạn không có ca giảng dạy nào trong lịch phân công. Bạn không cần thực hiện điểm danh.
                </span>
              </div>
            ) : (
              <select
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
              >
                <option value="">-- Ca tự động theo giờ hiện tại --</option>
                {todaySchedules.map((s) => {
                  const log = scheduleAttendanceMap.get(s._id);
                  const statusNote = log ? (log.checkOutTime ? ' (Đã hoàn thành)' : ' (Đang trong ca)') : '';
                  return (
                    <option key={s._id} value={s._id}>
                      {s.subjectName || 'Lớp học phần'} - Phòng {s.roomId || 'A1'} ({s.startTime || '07:00'} -{' '}
                      {s.endTime || '09:15'}){statusNote}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* 3 PHƯƠNG THỨC ĐIỂM DANH THỰC TẾ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Phương thức xác thực:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Cách 1: GPS Bán kính khuôn viên */}
              <button
                type="button"
                onClick={() => {
                  setIsCheckInModalOpen(false);
                  navigate('/attendance/check-in?tab=gps');
                }}
                className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition text-left group bg-white shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <Navigation className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Định Vị GPS</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Xác thực vị trí thiết bị trong bán kính trường học.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-blue-600 mt-2.5 inline-flex items-center gap-1 group-hover:underline">
                  Mở GPS →
                </span>
              </button>

              {/* Cách 2: Quét mã QR */}
              <button
                type="button"
                onClick={() => {
                  setIsCheckInModalOpen(false);
                  navigate('/attendance/check-in?tab=qr');
                }}
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition text-left group bg-white shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Quét Mã QR</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Camera quét mã QR động tại giảng đường.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 mt-2.5 inline-flex items-center gap-1 group-hover:underline">
                  Mở Camera →
                </span>
              </button>

              {/* Cách 3: Face ID Kiosk */}
              <button
                type="button"
                onClick={() => {
                  setIsCheckInModalOpen(false);
                  navigate('/attendance/kiosk');
                }}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition text-left group bg-white shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Kiosk Face ID</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Nhận diện khuôn mặt AI tự động tại cổng / sảnh.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 mt-2.5 inline-flex items-center gap-1 group-hover:underline">
                  Mở Kiosk AI →
                </span>
              </button>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCheckInModalOpen(false)}
              disabled={checkinSubmitting}
              className="text-xs"
            >
              Đóng
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleQuickCheckInSubmit}
              isLoading={checkinSubmitting}
              disabled={checkinSubmitting || todaySchedules.length === 0}
              className="bg-blue-600 hover:bg-blue-700 shadow-sm text-xs font-semibold"
            >
              Check-in Nhanh Trực Tiếp
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
