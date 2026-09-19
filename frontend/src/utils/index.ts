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
 * Token Management Utilities
 */
const ACCESS_TOKEN_KEY = 'edu_access_token';
const REFRESH_TOKEN_KEY = 'edu_refresh_token';
const USER_KEY = 'edu_user';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

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
