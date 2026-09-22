import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Fingerprint,
  Hand,
  Monitor,
  Navigation,
  QrCode,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  X,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { attendanceApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import {
  AttendanceLog,
  AttendanceMethod,
  AttendanceStatus,
  Schedule,
  ShiftConfig,
  User,
} from '../../types';
import { UserAvatar } from '../../components';
import { getSafeMediaUrl } from '../../utils';

const PAGE_SIZE = 15;
const NON_WORKING_STATUSES: AttendanceStatus[] = ['ABSENT', 'EXCUSED_ABSENCE'];

const statusOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'ON_TIME', label: 'Đúng giờ' },
  { value: 'LATE', label: 'Đi muộn' },
  { value: 'EARLY_LEAVE', label: 'Về sớm' },
  { value: 'ABSENT', label: 'Vắng mặt' },
  { value: 'EXCUSED_ABSENCE', label: 'Nghỉ có phép' },
];

const methodOptions: Array<{ value: AttendanceMethod; label: string }> = [
  { value: 'face', label: 'Face ID' },
  { value: 'gps', label: 'GPS' },
  { value: 'qr', label: 'QR' },
  { value: 'fingerprint', label: 'Vân tay' },
  { value: 'manual', label: 'Thủ công' },
  { value: 'admin_override', label: 'Admin điều chỉnh' },
  { value: 'system', label: 'Hệ thống tự động' },
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getUser = (log: AttendanceLog): Partial<User> | null =>
  isObject(log.userId) ? (log.userId as Partial<User>) : null;

const getShift = (log: AttendanceLog): Partial<ShiftConfig> | null =>
  isObject(log.shiftId) ? (log.shiftId as Partial<ShiftConfig>) : null;

const getSchedule = (log: AttendanceLog): Partial<Schedule> | null =>
  isObject(log.scheduleId) ? (log.scheduleId as Partial<Schedule>) : null;

const normalizeMethod = (method?: string): string => (method || '').toLowerCase();

const isValidDate = (value?: string): boolean => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const formatDateTime = (value?: string) => {
  if (!isValidDate(value)) {
    return null;
  }

  const date = new Date(value as string);
  return {
    time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    date: date.toLocaleDateString('vi-VN'),
  };
};

const getConfidenceLabel = (confidenceScore?: number): string | null => {
  if (confidenceScore === undefined || confidenceScore === null || Number.isNaN(confidenceScore)) {
    return null;
  }

  const percent = confidenceScore <= 1 ? confidenceScore * 100 : confidenceScore;
  return `${Math.max(0, Math.min(100, percent)).toFixed(0)}%`;
};

const getDeviceFallback = (method?: string, status?: AttendanceStatus): string => {
  if (status === 'ABSENT' || status === 'EXCUSED_ABSENCE' || normalizeMethod(method) === 'system') {
    return 'HỆ THỐNG';
  }
  switch (normalizeMethod(method)) {
    case 'face':
    case 'face_id':
      return 'KIOSK_CENTRAL';
    case 'gps':
      return 'GPS_DEVICE';
    case 'qr':
      return 'MOBILE_QR';
    case 'fingerprint':
      return 'FINGERPRINT';
    case 'admin_override':
      return 'ADMIN_OVERRIDE';
    case 'system':
      return 'SYSTEM';
    default:
      return 'WEB_CLIENT';
  }
};

const canShowTime = (status: AttendanceStatus): boolean => !NON_WORKING_STATUSES.includes(status);

export const AttendanceHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const requestIdRef = useRef(0);

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modal xem ảnh minh chứng điểm danh
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    status?: AttendanceStatus;
  } | null>(null);

  const dateRangeInvalid = useMemo(
    () => Boolean(fromDate && toDate && fromDate > toDate),
    [fromDate, toDate]
  );

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  const fetchHistory = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (dateRangeInvalid) {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await attendanceApi.getHistory({
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });

      if (requestIdRef.current !== requestId) return;

      if (!res?.success || !res.data) {
        throw new Error(res?.message || 'Không thể tải lịch sử chấm công');
      }

      const data = res.data as unknown;
      const records = Array.isArray(data)
        ? data
        : isObject(data) && Array.isArray(data.records)
        ? data.records
        : [];
      const totalFromServer =
        isObject(data) && typeof data.total === 'number' ? data.total : records.length;
      const totalPagesFromServer =
        isObject(data) && typeof data.totalPages === 'number'
          ? data.totalPages
          : Math.ceil(totalFromServer / PAGE_SIZE);
      const nextTotalPages = Math.max(1, totalPagesFromServer || 1);

      setTotal(totalFromServer);
      setTotalPages(nextTotalPages);

      if (page > nextTotalPages) {
        setLogs([]);
        setPage(nextTotalPages);
        return;
      }

      setLogs(records as AttendanceLog[]);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      console.error('Lỗi tải lịch sử chấm công:', error);
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      toast.error('Không thể tải lịch sử chấm công');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [dateRangeInvalid, fromDate, methodFilter, page, statusFilter, toDate]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchHistory();
    }, 0);

    return () => clearTimeout(timerId);
  }, [fetchHistory]);

  const renderStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'ON_TIME':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đúng giờ
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            Đi muộn
          </span>
        );
      case 'EARLY_LEAVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            Về sớm
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5" />
            Vắng mặt
          </span>
        );
      case 'EXCUSED_ABSENCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Nghỉ có phép
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">{status || 'Không rõ'}</span>;
    }
  };

  const renderMethodBadge = (
    method?: AttendanceMethod,
    confidenceScore?: number,
    status?: AttendanceStatus,
    isManualOverride?: boolean,
    hasCheckIn?: boolean
  ) => {
    // Nếu là bản ghi vắng mặt / nghỉ phép tự động hoặc do hệ thống tạo (hoặc không có lượt check-in thực tế)
    const isSystemRecord =
      method === 'system' ||
      ((status === 'ABSENT' || status === 'EXCUSED_ABSENCE' || !hasCheckIn) &&
        (method === 'manual' || !method) &&
        !isManualOverride);

    if (isSystemRecord) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
          <Monitor className="w-3.5 h-3.5 text-slate-500" />
          Hệ thống
        </span>
      );
    }

    if (isManualOverride || method === 'admin_override') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
          Admin
        </span>
      );
    }

    const normalizedMethod = normalizeMethod(method);
    const confidenceLabel = getConfidenceLabel(confidenceScore);

    switch (normalizedMethod) {
      case 'face':
      case 'face_id':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
            <ScanFace className="w-3.5 h-3.5 text-violet-600" />
            <span>Face ID</span>
            {confidenceLabel && (
              <span className="text-[10px] bg-violet-200/70 px-1.5 py-0.5 rounded font-mono">
                {confidenceLabel}
              </span>
            )}
          </span>
        );
      case 'gps':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            GPS
          </span>
        );
      case 'qr':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 whitespace-nowrap">
            <QrCode className="w-3.5 h-3.5 text-cyan-600" />
            QR
          </span>
        );
      case 'fingerprint':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            <Fingerprint className="w-3.5 h-3.5 text-slate-600" />
            Vân tay
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <Hand className="w-3.5 h-3.5 text-blue-600" />
            Thủ công
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 whitespace-nowrap">
            <Monitor className="w-3.5 h-3.5" />
            {method || 'Không rõ'}
          </span>
        );
    }
  };

  const renderTimeBlock = (
    value: string | undefined,
    status: AttendanceStatus,
    emptyText: string
  ) => {
    const formatted = canShowTime(status) ? formatDateTime(value) : null;

    if (!formatted) {
      return <span className="text-xs text-gray-400 font-mono">{emptyText}</span>;
    }

    return (
      <div>
        <div className="text-xs font-bold font-mono text-gray-900">{formatted.time}</div>
        <div className="text-[11px] text-gray-400">{formatted.date}</div>
      </div>
    );
  };

  const renderPerson = (log: AttendanceLog) => {
    const attendanceUser = getUser(log);
    const name = attendanceUser?.fullName || 'Không xác định';
    const email = attendanceUser?.email || 'N/A';

    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <UserAvatar
          user={(attendanceUser as User) || { fullName: name, email }}
          size="sm"
        />
        <div className="min-w-0">
          <div className="font-bold text-gray-900 text-xs truncate leading-snug">{name}</div>
          <div className="text-[11px] text-gray-400 truncate font-mono mt-0.5">{email}</div>
        </div>
      </div>
    );
  };

  const renderCapturedImage = (log: AttendanceLog, isMobile = false) => {
    const rawImage = log.capturedImage;
    if (!rawImage) {
      if (isMobile) return null;
      return <span className="text-gray-300 text-xs italic font-mono">--</span>;
    }

    const safeUrl = getSafeMediaUrl(rawImage);
    const attendanceUser = getUser(log);
    const name = attendanceUser?.fullName || 'Cán bộ';
    const formatted = formatDateTime(log.checkInTime);
    const timeStr = formatted ? `${formatted.time} - ${formatted.date}` : '';
    const confidenceLabel = getConfidenceLabel(log.confidenceScore);

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewImage({
            url: safeUrl,
            title: `Minh chứng: ${name}`,
            subtitle: `${timeStr} • Phương thức: ${normalizeMethod(log.method).toUpperCase()}${
              confidenceLabel ? ` • Khớp: ${confidenceLabel}` : ''
            }`,
            status: log.status,
          });
        }}
        className="group inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 transition shadow-2xs cursor-pointer"
        title="Bấm để xem ảnh minh chứng điểm danh"
      >
        <div className="w-8 h-8 rounded-lg overflow-hidden relative shrink-0 bg-slate-200 border border-slate-200">
          <img
            src={safeUrl}
            alt="Minh chứng"
            className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
            <Eye className="w-3.5 h-3.5" />
          </div>
        </div>
        <span className="text-[11px] font-bold text-violet-700 hidden xl:inline pr-1">
          Xem ảnh
        </span>
      </button>
    );
  };

  const renderShift = (log: AttendanceLog) => {
    const shift = getShift(log);
    const schedule = getSchedule(log);
    const room = schedule?.roomId || schedule?.room;
    const subject = schedule?.subjectName || schedule?.subjectCode;

    return (
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-900 truncate">
          {subject || shift?.name || 'Ca làm việc'}
        </div>
        <div className="text-[11px] text-gray-500 truncate mt-0.5">
          {room ? `Phòng ${room}` : shift?.startTime && shift?.endTime ? `${shift.startTime} - ${shift.endTime}` : 'Theo ca chuẩn'}
        </div>
      </div>
    );
  };

  const renderMobileLog = (log: AttendanceLog) => {
    const checkoutEmptyText = canShowTime(log.status) ? 'Chưa check-out' : '--:--';

    return (
      <article key={log._id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition">
        <div className="flex items-start justify-between gap-3">
          {renderPerson(log)}
          <div className="shrink-0">{renderStatusBadge(log.status)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ca / phòng</div>
            {renderShift(log)}
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Phương thức</div>
            {renderMethodBadge(log.method, log.confidenceScore, log.status, log.isManualOverride, Boolean(log.checkInTime))}
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Check-in</div>
            {renderTimeBlock(log.checkInTime, log.status, '--:--')}
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Check-out</div>
            {renderTimeBlock(log.checkOutTime, log.status, checkoutEmptyText)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
            <Monitor className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate max-w-[170px]">{log.deviceId || getDeviceFallback(log.method, log.status)}</span>
          </div>
          {log.capturedImage && (
            <div className="shrink-0 flex items-center gap-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold">Minh chứng:</span>
              {renderCapturedImage(log, true)}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Lịch sử chấm công đa phương thức</h1>
            <p className="text-sm text-gray-500">
              {user?.role === 'admin'
                ? 'Theo dõi & đối soát toàn bộ dữ liệu điểm danh trên toàn hệ thống'
                : user?.role === 'truongkhoa'
                ? 'Dữ liệu chấm công của cán bộ, giảng viên thuộc khoa quản lý'
                : 'Nhật ký chấm công và thời gian làm việc cá nhân'}
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchHistory()}
          disabled={loading || dateRangeInvalid}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-lg border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm sm:text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">Tất cả trạng thái</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phương thức</label>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm sm:text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">Tất cả phương thức</option>
              {methodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm sm:text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Đến ngày</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm sm:text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {dateRangeInvalid && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Khoảng ngày chưa hợp lệ: ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100 text-xs text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-3.5 px-4">Nhân sự / Giảng viên</th>
                <th className="py-3.5 px-4">Ca làm việc / Lịch học</th>
                <th className="py-3.5 px-4">Check-in</th>
                <th className="py-3.5 px-4">Check-out</th>
                <th className="py-3.5 px-4">Phương thức</th>
                <th className="py-3.5 px-4">Ảnh Minh Chứng</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Thiết bị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Đang tải dữ liệu chấm công...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Không có bản ghi chấm công nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const checkoutEmptyText = canShowTime(log.status) ? 'Chưa check-out' : '--:--';

                  return (
                    <tr key={log._id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 max-w-[240px]">{renderPerson(log)}</td>
                      <td className="py-3.5 px-4 max-w-[240px]">{renderShift(log)}</td>
                      <td className="py-3.5 px-4">
                        {renderTimeBlock(log.checkInTime, log.status, '--:--')}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderTimeBlock(log.checkOutTime, log.status, checkoutEmptyText)}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderMethodBadge(log.method, log.confidenceScore, log.status, log.isManualOverride, Boolean(log.checkInTime))}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderCapturedImage(log)}
                      </td>
                      <td className="py-3.5 px-4">{renderStatusBadge(log.status)}</td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 font-mono max-w-[180px]">
                        <span className="block truncate">{log.deviceId || getDeviceFallback(log.method, log.status)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="py-12 px-4 text-center text-gray-400">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-sm">Đang tải dữ liệu chấm công...</span>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-gray-400">
              Không có bản ghi chấm công nào phù hợp với bộ lọc
            </div>
          ) : (
            logs.map(renderMobileLog)
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500">
          <div>
            Hiển thị <span className="font-bold text-gray-900">{showingFrom}</span>
            {' - '}
            <span className="font-bold text-gray-900">{showingTo}</span>
            {' / '}
            <span className="font-bold text-gray-900">{total}</span> lượt chấm công
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:pr-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading || dateRangeInvalid}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Trang <strong className="text-gray-900">{page}</strong> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading || dateRangeInvalid}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Trang tiếp"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Phóng To Xem Ảnh Minh Chứng Điểm Danh */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-slate-900 text-sm truncate">{previewImage.title}</h3>
                {previewImage.subtitle && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{previewImage.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 transition cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image Container */}
            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[70vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt="Minh chứng"
                className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 italic">
                Ảnh chụp minh chứng tự động từ camera khi nhận diện
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistoryPage;
