import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User } from '../../types';
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

  // Widget Block Error Tracking (Tránh stale state & hiển thị lỗi minh bạch)
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
      // Sử dụng chuẩn múi giờ Việt Nam (Asia/Ho_Chi_Minh) tránh sai lệch ngày giờ
      const todayStr = getVietnamDateString();
      const [vYear, vMonth] = todayStr.split('-').map(Number);
      const firstDayOfMonth = `${vYear}-${String(vMonth).padStart(2, '0')}-01`;
      const lastDayNum = new Date(vYear, vMonth, 0).getDate();
      const lastDayOfMonth = `${vYear}-${String(vMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      const currentUserId = user?._id;

      // 1. Fetch Today Schedules & All Schedules (Tối ưu: chỉ lấy count với page=1&limit=1)
      const [todaySchedRes, allSchedRes] = await Promise.allSettled([
        scheduleService.getTodaySchedules({ date: todayStr }),
        scheduleService.getSchedules({ page: 1, limit: 1 }),
      ]);

      if (todaySchedRes.status === 'fulfilled' && todaySchedRes.value) {
        const rawSchedules = todaySchedRes.value.schedules || [];
        // Sắp xếp thứ tự thời gian ca học tăng dần
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

      // Lọc và lưu trữ toàn bộ các lượt chấm công hôm nay của chính người dùng hiện tại
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

      // 5. Admin / Dean Extra Metrics (Tối ưu: chỉ lấy count với page=1&limit=1)
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

    // Đếm tần suất xuất hiện của mỗi shiftId trong danh sách ca hôm nay
    const shiftFrequency = new Map<string, number>();
    todaySchedules.forEach((s) => {
      const sId = getShiftIdFromSchedule(s);
      if (sId) {
        shiftFrequency.set(sId, (shiftFrequency.get(sId) || 0) + 1);
      }
    });

    // Bước 1: Ưu tiên ghép chính xác tuyệt đối theo scheduleId
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

    // Bước 2: Fallback sang shiftId chỉ khi ca đó là DUY NHẤT trong ngày (không có lịch thứ 2 trùng shiftId)
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

  // Ca làm việc đang mở (đã check-in thực tế nhưng chưa check-out, loại trừ ABSENT và EXCUSED_ABSENCE)
  const activeOpenLog = useMemo(() => {
    return todayLogs.find(
      (log) => log.checkInTime && !log.checkOutTime && log.status !== 'ABSENT' && log.status !== 'EXCUSED_ABSENCE'
    );
  }, [todayLogs]);

  // Ca tiếp theo chưa được điểm danh
  const nextUnattendedSchedule = useMemo(() => {
    return todaySchedules.find((s) => !scheduleAttendanceMap.has(s._id));
  }, [todaySchedules, scheduleAttendanceMap]);

  // Kiểm tra xem tất cả các ca hôm nay đã check-out hoặc đã hoàn tất (bao gồm nghỉ phép/vắng mặt) chưa
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

  // Current Date formatted in Vietnamese
  const todayFormatted = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Cảnh báo lỗi đồng bộ dữ liệu nếu có khối API bị lỗi */}
      {Object.values(blockErrors).some(Boolean) && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-4 text-amber-800 flex items-center justify-between text-xs shadow-xs">
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
      {/* 1. HERO WELCOME BANNER                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 p-6 sm:p-8 text-white shadow-2xl shadow-indigo-950/20 border border-slate-800">
        {/* Decorative Blurred Glows */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold backdrop-blur-md">
                <GraduationCap className="w-3.5 h-3.5 text-blue-300" />
                <span>{departmentName}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium backdrop-blur-md">
                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                <span className="capitalize">{todayFormatted}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Xin chào, {user?.fullName || 'Cán bộ'}!</span>
              <span className="text-2xl animate-pulse">👋</span>
            </h1>

            <p className="text-slate-300 text-sm leading-relaxed">
              Chào mừng bạn đến với Cổng quản trị chấm công & thời khóa biểu. Dữ liệu hệ thống đang được kết nối trực tiếp với máy chủ theo thời gian thực.
            </p>
          </div>

          {/* User Status Pills & Quick Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left lg:text-right">
                <p className="text-[11px] uppercase tracking-wider text-blue-200/80 font-medium">Vai trò</p>
                <p className="text-sm font-bold text-white flex items-center gap-1.5 justify-start lg:justify-end">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{ROLE_LABELS[role]}</span>
                </p>
              </div>

              {role !== 'admin' && (
                <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left lg:text-right">
                  <p className="text-[11px] uppercase tracking-wider text-blue-200/80 font-medium">Quỹ phép năm</p>
                  <p className="text-sm font-bold text-white">
                    {leaveBalance ? `${leaveBalance.remainingDays} / ${leaveBalance.annualLeaveQuota} ngày` : `${user?.annualLeaveQuota || 12} ngày`}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-medium text-xs rounded-xl shadow-xs backdrop-blur-md transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Đang cập nhật...' : 'Cập nhật số liệu'}</span>
              </Button>

              <Link to="/ai-assistant">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-md border border-blue-400/30"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-300" />
                  <span>Hỏi Trợ lý AI</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. REAL-TIME KPI STATS CARDS                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* CARD 1: Điểm danh hôm nay */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAdminOrDean ? 'Tỷ Lệ Đúng Giờ Hệ Thống' : 'Chấm Công Hôm Nay'}
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                (isAdminOrDean && onTimePercentage >= 85) || allSchedulesCompleted
                  ? 'bg-emerald-50 text-emerald-600'
                  : activeOpenLog
                  ? 'bg-blue-50 text-blue-600'
                  : todaySchedules.length > 0 && !allSchedulesCompleted
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {loading ? (
            <div className="h-8 bg-slate-100 animate-pulse rounded-lg mt-3 w-32" />
          ) : isAdminOrDean ? (
            <>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {totalAttRecords > 0 ? `${onTimePercentage}%` : 'N/A'}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {totalAttRecords > 0 ? 'đúng giờ' : 'chưa có dữ liệu'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {totalAttRecords > 0
                    ? `${onTimeCount} đúng giờ / ${totalAttRecords} tổng lượt`
                    : 'Tháng này chưa có lượt chấm công nào'}
                </span>
              </p>
            </>
          ) : todaySchedules.length === 0 ? (
            <>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Không có ca làm việc
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Hôm nay bạn không có lịch phân công giảng dạy.</p>
            </>
          ) : activeOpenLog ? (
            <>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Đang trong ca làm việc
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCheckOut(activeOpenLog._id)}
                  isLoading={checkingOutId === activeOpenLog._id}
                  className="py-1 px-3 text-xs rounded-xl border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5 text-amber-600" />
                  <span>Check-out ra ca</span>
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Vào ca: {formatTime(activeOpenLog.checkInTime)}</span>
                <span className="text-[11px] text-slate-400">
                  ({ATTENDANCE_STATUS_MAP[activeOpenLog.status]?.label || activeOpenLog.status})
                </span>
              </p>
            </>
          ) : allSchedulesCompleted ? (
            <>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Đã hoàn thành các ca
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Đã điểm danh và check-out đủ {todaySchedules.length} ca hôm nay.
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  {nextUnattendedSchedule ? 'Chưa vào ca tiếp theo' : 'Chưa điểm danh'}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    if (nextUnattendedSchedule) {
                      setSelectedScheduleId(nextUnattendedSchedule._id);
                    }
                    setIsCheckInModalOpen(true);
                  }}
                  className="py-1 px-3 text-xs rounded-xl shadow-xs font-semibold bg-blue-600 hover:bg-blue-700"
                >
                  Điểm danh vào ca
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {nextUnattendedSchedule
                  ? `${nextUnattendedSchedule.subjectName || 'Lớp học phần'} (${nextUnattendedSchedule.startTime || '07:00'})`
                  : 'Hôm nay bạn chưa ghi nhận giờ vào ca.'}
              </p>
            </>
          )}
        </div>

        {/* CARD 2: Ca dạy hôm nay & lịch học */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAdminOrDean ? 'Ca Dạy Diễn Ra Hôm Nay' : 'Lịch Trình Hôm Nay'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-105">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>

          {loading ? (
            <div className="h-8 bg-slate-100 animate-pulse rounded-lg mt-3 w-28" />
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                {todaySchedules.length} <span className="text-base font-normal text-slate-500">Ca học</span>
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                {todaySchedules.length > 0 ? (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">
                      P.{todaySchedules[0].roomId || 'A1'} (
                      {todaySchedules[0].startTime || '07:00'} - {todaySchedules[0].endTime || '11:30'})
                    </span>
                  </>
                ) : (
                  <span>Hôm nay không có lịch giảng dạy</span>
                )}
              </p>
            </>
          )}
        </div>

        {/* CARD 3: Đơn xin nghỉ / Hộp duyệt đơn */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAdminOrDean ? 'Đơn Nghỉ Chờ Phê Duyệt' : 'Quỹ Phép Còn Lại'}
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                isAdminOrDean && pendingLeaves.length > 0
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
          </div>

          {loading ? (
            <div className="h-8 bg-slate-100 animate-pulse rounded-lg mt-3 w-28" />
          ) : isAdminOrDean ? (
            <>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`text-2xl sm:text-3xl font-bold ${
                    totalPendingLeavesCount > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {totalPendingLeavesCount}
                </span>
                <span className="text-sm font-medium text-slate-500">đơn chờ</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalPendingLeavesCount > 0 ? (
                  <Link
                    to="/leave/approvals"
                    className="text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Vào duyệt ngay</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <span>Tất cả đơn từ đã được xử lý</span>
                )}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {leaveBalance?.remainingDays ?? user?.annualLeaveQuota ?? 12}
                </span>
                <span className="text-sm font-medium text-slate-500">ngày còn lại</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Đã dùng: {leaveBalance?.daysUsed || 0} ngày • Hạn mức:{' '}
                {leaveBalance?.annualLeaveQuota || user?.annualLeaveQuota || 12} ngày
              </p>
            </>
          )}
        </div>

        {/* CARD 4: Quy mô hệ thống / Trạng thái kỷ luật */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {role === 'admin'
                ? 'Quy Mô Nhân Sự'
                : role === 'truongkhoa'
                ? 'Nhân Sự Trong Khoa'
                : 'Thống Kê Cá Nhân'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center transition-transform group-hover:scale-105">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {loading ? (
            <div className="h-8 bg-slate-100 animate-pulse rounded-lg mt-3 w-28" />
          ) : isAdminOrDean ? (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                {totalUsersCount} <span className="text-base font-normal text-slate-500">Cán bộ</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalDeptsCount} Khoa/Bộ môn • {totalScheduleCount} lịch học kỳ
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-emerald-600">{onTimeCount}</span>
                <span className="text-xs font-medium text-slate-500">buổi đúng giờ</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Đi muộn: {lateCount} • Vắng mặt: {absentCount}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN SECTION: TODAY SCHEDULE & RECENT ATTENDANCE           */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Today Schedules & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* LỊCH GIẢNG DẠY HÔM NAY */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isAdminOrDean ? 'Thời Khóa Biểu Giảng Dạy Trong Ngày' : 'Lịch Trình Hôm Nay Của Bạn'}
                  </h3>
                  <p className="text-xs text-slate-500">Các ca giảng dạy và công tác có hiệu lực hôm nay</p>
                </div>
              </div>

              <Link
                to="/schedules"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                <span>Xem tuần</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : todaySchedules.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Hôm nay không có lịch giảng dạy"
                description="Bạn không có ca dạy hoặc lịch công tác phân công trong ngày hôm nay. Hãy tra cứu lịch cả tuần để chuẩn bị."
                actionText="Xem thời khóa biểu tuần"
                onAction={() => navigate('/schedules')}
                className="py-10"
              />
            ) : (
              <div className="space-y-3">
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

                  return (
                    <div
                      key={item._id || idx}
                      className="p-4 rounded-2xl bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Giờ</span>
                          <span className="text-xs font-bold text-slate-800">{startTime.slice(0, 5)}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">
                              {item.subjectName || item.note || 'Lớp học phần chính khóa'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-100/70 text-blue-700 text-[11px] font-semibold">
                              {shiftName}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <strong className="text-slate-700">Phòng {item.roomId || 'A1-402'}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {startTime} - {endTime}
                              </span>
                            </span>
                            {isAdminOrDean && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-700">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{lecturerName}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isAdminOrDean && (
                        <div className="shrink-0 flex items-center justify-end">
                          {(() => {
                            const log = scheduleAttendanceMap.get(item._id);
                            if (!log) {
                              return (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setSelectedScheduleId(item._id);
                                    setIsCheckInModalOpen(true);
                                  }}
                                  className="text-xs py-1.5 px-3.5 rounded-xl shadow-xs font-semibold bg-blue-600 hover:bg-blue-700"
                                >
                                  Điểm danh
                                </Button>
                              );
                            }
                            if (log.status === 'ABSENT') {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Vắng mặt</span>
                                </span>
                              );
                            }
                            if (log.status === 'EXCUSED_ABSENCE') {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Nghỉ có phép</span>
                                </span>
                              );
                            }
                            if (!log.checkOutTime) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span>Vào: {formatTime(log.checkInTime)}</span>
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCheckOut(log._id)}
                                    isLoading={checkingOutId === log._id}
                                    className="text-xs py-1.5 px-3 rounded-xl border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold flex items-center gap-1.5 shadow-xs"
                                  >
                                    <LogOut className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Check-out ra ca</span>
                                  </Button>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col sm:items-end gap-0.5">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-xl border border-emerald-200/80">
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

          {/* NHẬT KÝ ĐIỂM DANH GẦN ĐÂY */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Nhật Ký Chấm Công Gần Nhất</h3>
                  <p className="text-xs text-slate-500">Lịch sử quẹt thẻ, nhận diện khuôn mặt và chấm công</p>
                </div>
              </div>

              <Link
                to="/attendance/history"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

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
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <th className="pb-3 pr-4">Thời gian</th>
                      {isAdminOrDean && <th className="pb-3 px-4">Cán bộ</th>}
                      <th className="pb-3 px-4">Vào ca</th>
                      <th className="pb-3 px-4">Ra ca</th>
                      <th className="pb-3 px-4">Trạng thái</th>
                      <th className="pb-3 pl-4">Hình thức</th>
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
                        <tr key={log._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {formatDate(log.checkInTime || log.workDate || log.date || log.createdAt)}
                          </td>
                          {isAdminOrDean && (
                            <td className="py-3 px-4 font-medium text-slate-800 truncate max-w-[150px]">
                              {logUser?.fullName || 'Cán bộ'}
                            </td>
                          )}
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {log.status === 'ABSENT' || log.status === 'EXCUSED_ABSENCE' || !log.checkInTime
                              ? '—'
                              : formatTime(log.checkInTime)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {log.checkOutTime ? formatTime(log.checkOutTime) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] border ${statusInfo.bg} ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 pl-4 text-slate-600 font-medium">
                            {log.method === 'face' || log.method === 'FACE_ID' ? (
                              <span className="inline-flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-indigo-200">
                                <Camera className="w-3 h-3 text-indigo-500" />
                                <span>Face ID</span>
                                {log.confidenceScore && (
                                  <span className="text-[10px] text-indigo-400">
                                    ({Math.round(log.confidenceScore * 100)}%)
                                  </span>
                                )}
                              </span>
                            ) : log.method === 'gps' || log.method === 'GPS' ? (
                              <span className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-blue-200">
                                <Navigation className="w-3 h-3 text-blue-500" />
                                <span>GPS</span>
                              </span>
                            ) : log.method === 'qr' || log.method === 'QR' ? (
                              <span className="inline-flex items-center gap-1.5 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-purple-200">
                                <QrCode className="w-3 h-3 text-purple-500" />
                                <span>Mã QR</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-medium border border-slate-200">
                                <span>Hệ thống</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Widgets & Approvals */}
        <div className="space-y-6">
          {/* WIDGET 1: HỘP DUYỆT ĐƠN CHO ADMIN & TRƯỞNG KHOA */}
          {isAdminOrDean ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Đơn Cần Phê Duyệt</h4>
                    <p className="text-xs text-slate-500">Đơn xin nghỉ phép, đổi ca chờ xử lý</p>
                  </div>
                </div>
                <Link
                  to="/leave/approvals"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Tất cả
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : pendingLeaves.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Không có đơn chờ duyệt</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tất cả đơn nghỉ đã được giải quyết.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.map((req) => {
                    const applicant =
                      typeof req.userId === 'object' && req.userId !== null
                        ? (req.userId as { fullName?: string; email?: string })
                        : null;

                    return (
                      <div
                        key={req._id}
                        className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60 hover:bg-amber-50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[160px]">
                            {applicant?.fullName || 'Giảng viên'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">
                            Chờ duyệt
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-1 italic">
                          "{req.reason || 'Xin nghỉ có việc riêng'}"
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/40 text-[10px] text-slate-500 font-medium">
                          <span>
                            {formatDate(req.startDate)} - {formatDate(req.endDate)}
                          </span>
                          <Link
                            to="/leave/approvals"
                            className="text-indigo-600 hover:underline font-bold"
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
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Đơn Nghỉ Phép Của Bạn</h4>
                    <p className="text-xs text-slate-500">Tiến độ xét duyệt đơn gần đây</p>
                  </div>
                </div>
                <Link to="/leave/create" className="text-xs font-semibold text-blue-600 hover:underline">
                  + Tạo mới
                </Link>
              </div>

              {myRecentLeaves.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Chưa có đơn từ nào</p>
                  <Link to="/leave/create">
                    <Button variant="outline" size="sm" className="mt-2 text-xs">
                      Tạo đơn xin nghỉ
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myRecentLeaves.map((leave) => {
                    const statusConfig = LEAVE_STATUS_MAP[leave.status] || {
                      label: leave.status,
                      color: 'text-slate-700',
                      bg: 'bg-slate-100',
                    };

                    return (
                      <div
                        key={leave._id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 capitalize">
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
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Cơ Cấu Điểm Danh Tháng</h4>
            <p className="text-xs text-slate-500 mb-4">Tổng hợp tỷ lệ chấp hành giờ giảng dạy</p>

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

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Xem biểu đồ chuyên sâu</span>
              <Link
                to="/reports"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                <span>Mở Báo Cáo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* WIDGET 3: LỐI TẮT THAO TÁC NHANH */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm">
            <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Phím Tắt Nghiệp Vụ</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">Các chức năng phổ biến cho {ROLE_LABELS[role]}</p>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/schedules"
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition flex flex-col items-center justify-center text-center gap-1.5"
              >
                <CalendarDays className="w-5 h-5 text-blue-300" />
                <span>Thời Khóa Biểu</span>
              </Link>

              {role !== 'admin' && (
                <Link
                  to="/leave/create"
                  className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <FileText className="w-5 h-5 text-indigo-300" />
                  <span>Làm Đơn Nghỉ</span>
                </Link>
              )}

              <Link
                to={isAdminOrDean ? '/attendance' : '/attendance/check-in'}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition flex flex-col items-center justify-center text-center gap-1.5"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>Chấm Công</span>
              </Link>

              <Link
                to="/ai-assistant"
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition flex flex-col items-center justify-center text-center gap-1.5"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Trợ Lý AI</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ATTENDANCE ACTION MODAL: CHẤM CÔNG THỰC TẾ               */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        title="Chọn Hình Thức Điểm Danh Vào Ca"
        maxWidth="lg"
      >
        <div className="space-y-5 pt-1">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 text-blue-900 text-xs leading-relaxed flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-blue-950 text-sm">
                Thời gian ghi nhận thực tế: {new Date().toLocaleTimeString('vi-VN')}
              </p>
              <p className="text-slate-600 mt-0.5">
                Hệ thống xác thực vị trí vệ tinh GPS trong khuôn viên trường hoặc đối soát mã QR / Face ID để đảm bảo tính minh bạch.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Ca giảng dạy / công tác hôm nay:
            </label>
            {todaySchedules.length === 0 ? (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Hôm nay bạn không có ca giảng dạy nào trong lịch phân công. Bạn không cần thực hiện điểm danh.
                </span>
              </div>
            ) : (
              <select
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-xs font-medium text-slate-800"
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Phương thức xác thực:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cách 1: GPS Bán kính khuôn viên */}
              <button
                type="button"
                onClick={() => {
                  setIsCheckInModalOpen(false);
                  navigate('/attendance/check-in?tab=gps');
                }}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition text-left group bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Định Vị GPS</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Xác thực vị trí thiết bị trong bán kính trường học.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-blue-600 mt-3 inline-flex items-center gap-1 group-hover:underline">
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
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition text-left group bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Quét Mã QR</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Camera quét mã QR động tại giảng đường hoặc màn hình phòng ban.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 mt-3 inline-flex items-center gap-1 group-hover:underline">
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
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition text-left group bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                    <Camera className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Kiosk Face ID</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Nhận diện khuôn mặt AI tự động tại cổng trường hoặc sảnh chính.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 mt-3 inline-flex items-center gap-1 group-hover:underline">
                  Mở Kiosk AI →
                </span>
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCheckInModalOpen(false)}
              disabled={checkinSubmitting}
            >
              Đóng
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleQuickCheckInSubmit}
              isLoading={checkinSubmitting}
              disabled={checkinSubmitting || todaySchedules.length === 0}
              className="bg-blue-600 hover:bg-blue-700 shadow-sm"
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
