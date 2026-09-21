// =======================================================
// 1. User & Authentication Types (TV A)
// =======================================================
export type Role = 'admin' | 'truongkhoa' | 'giangvien' | 'nhanvien';

export interface User {
  _id: string;
  code?: string;
  fullName: string;
  email: string;
  role: Role;
  departmentId: string | Department;
  phoneNumber?: string;
  avatar?: string;
  isActive: boolean;
  isVerified?: boolean;
  faceDescriptor?: number[]; // Vector 128 chiều (TV B)
  faceDescriptors?: number[][]; // Đa vector nhiều góc (TV B)
  faceDataRegistered?: boolean;
  faceRegistered?: boolean;
  annualLeaveQuota?: number; // Hạn mức ngày phép trong năm
  remainingLeaveDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    token?: string;
    accessToken?: string;
    refreshToken?: string;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

// =======================================================
// 2. Department & Hierarchy Types (TV A)
// =======================================================
export interface Department {
  _id: string;
  name: string;
  code?: string;
  type?: 'khoa' | 'bomon' | 'phongban';
  parentId?: string | null | Department;
  managerId?: string | null | User;
  location?: {
    lat?: number;
    lng?: number;
  };
  description?: string;
  children?: Department[];
  createdAt?: string;
  updatedAt?: string;
}

// =======================================================
// 3. ShiftConfig & Schedules (TV B)
// =======================================================
export interface ShiftConfig {
  _id: string;
  name: string; // Ca sáng, Ca chiều, Ca tối
  code?: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  lateThresholdMinutes: number; // Ngưỡng trễ cho phép (phút)
  earlyExitThresholdMinutes?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Schedule {
  _id: string;
  userId: string | User;
  shiftId: string | ShiftConfig;
  departmentId?: string | Department;
  weekday: number; // 0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy
  dayOfWeek?: number; // alias
  roomId?: string;
  room?: string; // alias
  startTime?: string;
  endTime?: string;
  isRecurring?: boolean;
  startDate?: string;
  endDate?: string;
  subjectName?: string;
  subjectCode?: string;
  academicYear?: string;
  semester?: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

// =======================================================
// 4. Attendance & Face ID Types (TV B)
// =======================================================
export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'EXCUSED_ABSENCE';
export type AttendanceMethod =
  | 'manual'
  | 'face'
  | 'qr'
  | 'gps'
  | 'fingerprint'
  | 'admin_override'
  | 'FACE_ID'
  | 'MANUAL'
  | 'GPS'
  | 'QR';

export interface AttendanceLog {
  _id: string;
  userId: string | User;
  scheduleId?: string | Schedule;
  shiftId?: string | ShiftConfig;
  date: string;
  workDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  confidenceScore?: number;
  deviceId?: string;
  isManualOverride?: boolean;
  capturedImage?: string;
  workingDuration?: {
    totalMinutes: number;
    formatted: string;
  };
  earlyLeave?: {
    isEarlyLeave: boolean;
    earlyMinutes: number;
  };
  lateMinutes?: number;
  earlyMinutes?: number;
  note?: string;
  approvedBy?: string | User;
  createdAt?: string;
}

export interface FaceCheckinRequest {
  faceDescriptor?: number[]; // Vector 128 số thực trích từ face-api.js
  faceDescriptors?: number[][];
  image?: string; // Base64 dự phòng nếu cần lưu minh chứng
  capturedImage?: string;
}

export interface FaceCheckinResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    attendance: AttendanceLog;
    confidenceScore: number;
    status: AttendanceStatus;
    checkInTime: string;
  };
}

export interface RegisterFaceDescriptorRequest {
  faceDescriptor?: number[];
  faceDescriptors?: number[][];
}

// =======================================================
// 5. Leave Requests & Quota (TV C)
// =======================================================
export type LeaveType = 'nghi_phep' | 'day_bu' | 'doi_ca' | 'ANNUAL' | 'SICK' | 'MATERNITY' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  _id: string;
  userId: string | User;
  type?: LeaveType;
  leaveType?: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
  evidenceFile?: string;
  status: LeaveStatus;
  approvalNote?: string;
  rejectionReason?: string;
  approvedBy?: string | User;
  reviewedBy?: string | User;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalanceResponse {
  annualLeaveQuota: number;
  usedLeaveDays: number;
  remainingLeaveDays: number;
}

export interface ApproveLeavePayload {
  approvalNote?: string;
}

export interface RejectLeavePayload {
  rejectionReason: string; // Bắt buộc theo ràng buộc backend
}

// =======================================================
// 6. Reports & Gemini AI Chat (TV C)
// =======================================================
export interface AttendanceReportSummary {
  totalSchedules: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedCount: number;
  onTimeRate: number; // Phần trăm %
}

export interface MonthlyReportItem {
  departmentId: string;
  departmentName: string;
  totalMembers: number;
  onTimeRate: number;
  lateRate: number;
  absentRate: number;
}

export interface AiChatRequest {
  question: string;
}

export interface AiChatResponse {
  success: boolean;
  data: {
    question: string;
    answer: string; // Nội dung Markdown được Gemini phản hồi
    timestamp: string;
  };
}

// =======================================================
// 7. Audit Log (TV A)
// =======================================================
export interface AuditLog {
  _id: string;
  userId: string | User;
  action: string;
  targetModel?: string;
  targetId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// =======================================================
// 8. Standard API Wrapper & Pagination
// =======================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  errorCode?: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: PaginatedData<T> | T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
