import { AttendanceStatus, LeaveStatus, Role } from '../types';

export type ClassValue = string | number | boolean | undefined | null | { [key: string]: boolean | undefined | null };

/**
 * Combine conditional classes (supports strings, falsy values, and objects)
 */
export function cn(...classes: ClassValue[]): string {
  const result: string[] = [];

  for (const item of classes) {
    if (!item) continue;
    if (typeof item === 'string') {
      result.push(item);
    } else if (typeof item === 'object') {
      for (const [key, val] of Object.entries(item)) {
        if (val) result.push(key);
      }
    }
  }

  return result.join(' ');
}

/**
 * Format ISO date string to DD/MM/YYYY
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format ISO date string to HH:mm
 */
export function formatTime(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format ISO date string to HH:mm DD/MM/YYYY
 */
export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return `${formatTime(date)} ${formatDate(date)}`;
}

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo múi giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getVietnamDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Token Management Utilities (Session-based & Inactivity Timeout)
 */
const ACCESS_TOKEN_KEY = 'edu_access_token';
const REFRESH_TOKEN_KEY = 'edu_refresh_token';
const USER_KEY = 'edu_user';
const LAST_ACTIVE_KEY = 'edu_last_active';

// Thời gian tối đa không hoạt động trước khi phiên hết hạn (30 phút)
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (tokenStorage.isSessionExpired()) {
      tokenStorage.clear();
      return null;
    }
    // Xóa triệt để token cũ trong localStorage nếu còn sót lại
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) localStorage.removeItem(ACCESS_TOKEN_KEY);
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccessToken: (token: string): void => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    tokenStorage.updateActivity();
  },
  getRefreshToken: (): string | null => {
    if (localStorage.getItem(REFRESH_TOKEN_KEY)) localStorage.removeItem(REFRESH_TOKEN_KEY);
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken: (token: string): void => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  getUser: () => {
    if (tokenStorage.isSessionExpired()) {
      tokenStorage.clear();
      return null;
    }
    if (localStorage.getItem(USER_KEY)) localStorage.removeItem(USER_KEY);
    const raw = sessionStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: unknown): void => {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    tokenStorage.updateActivity();
  },
  getLastActiveTime: (): number => {
    const raw = sessionStorage.getItem(LAST_ACTIVE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  },
  updateActivity: (): void => {
    sessionStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  },
  isSessionExpired: (): boolean => {
    const raw = sessionStorage.getItem(LAST_ACTIVE_KEY);
    const hasToken = !!sessionStorage.getItem(ACCESS_TOKEN_KEY);
    // Nếu chưa có token thì không coi là session expired
    if (!hasToken || !raw) return false;
    const lastActive = parseInt(raw, 10) || 0;
    if (!lastActive) return false;
    return Date.now() - lastActive > INACTIVITY_TIMEOUT_MS;
  },
  clear: (): void => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(LAST_ACTIVE_KEY);

    // Xóa sạch dữ liệu phiên cũ lưu trong localStorage từ các phiên trước
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(LAST_ACTIVE_KEY);
    } catch {
      // Bỏ qua lỗi truy cập storage
    }
  },
};

// Dọn dẹp tàn dư cũ trong localStorage khi tải trang
try {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
} catch {
  // Bỏ qua nếu môi trường không cho phép truy cập localStorage
}

/**
 * Role Labels
 */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Quản trị viên',
  truongkhoa: 'Trưởng khoa / Bộ môn',
  giangvien: 'Giảng viên',
  nhanvien: 'Cán bộ / Nhân viên',
};

/**
 * Attendance Status Info
 */
export const ATTENDANCE_STATUS_MAP: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  ON_TIME: { label: 'Đúng giờ', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  LATE: { label: 'Đi muộn', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  EARLY_LEAVE: { label: 'Về sớm', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  ABSENT: { label: 'Vắng mặt', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  EXCUSED_ABSENCE: { label: 'Nghỉ có phép', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

/**
 * Leave Status Info
 */
export const LEAVE_STATUS_MAP: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  REJECTED: { label: 'Từ chối', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
};

export * from './errorHandler';

/**
 * Chuẩn hóa URL hình ảnh / tài liệu đính kèm:
 * - Thay thế triệt để http://chamcongdh.io.vn bằng https://chamcongdh.io.vn
 * - Nâng cấp http:// thành https:// khi web đang chạy trên HTTPS
 * - Tự động định tuyến qua /api/uploads/ để luôn được Nginx chuyển tiếp tới Backend Node.js
 * - Tránh hoàn toàn lỗi Mixed Content và tránh bị redirect sang /login khi xem file
 */
export function getSafeMediaUrl(url?: string | null): string {
  if (!url) return '';
  let safeUrl = url.trim();

  // 1. Chuẩn hóa domain & giao thức HTTPS
  if (safeUrl.startsWith('http://chamcongdh.io.vn')) {
    safeUrl = safeUrl.replace('http://chamcongdh.io.vn', 'https://chamcongdh.io.vn');
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && safeUrl.startsWith('http://')) {
    safeUrl = safeUrl.replace(/^http:\/\//i, 'https://');
  }

  // 2. Chuyển đổi /uploads/ -> /api/uploads/ để Nginx trên VPS luôn proxy về cổng 5000
  if (safeUrl.startsWith('/uploads/')) {
    safeUrl = `/api${safeUrl}`;
  } else if (safeUrl.includes('chamcongdh.io.vn/uploads/')) {
    safeUrl = safeUrl.replace('chamcongdh.io.vn/uploads/', 'chamcongdh.io.vn/api/uploads/');
  }

  return safeUrl;
}

