import { axiosClient } from '../api/axiosClient';
import { ApiResponse } from '../types';

export interface AttendanceReportData {
  totalRecords: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedAbsenceCount: number;
  approvedLeaveDays: number;
}

export interface MonthlyStaffReportItem {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    departmentId?: string;
  };
  totalWorkingDays: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedCount: number;
}

export interface WeeklyTrendPoint {
  label: string;
  rate: number;
  lateRate: number;
}

export interface MonthlyReportResponse {
  month: number;
  year: number;
  totalUsers: number;
  report: MonthlyStaffReportItem[];
  weeklyTrend?: WeeklyTrendPoint[];
}

export interface AttendanceReportFilter {
  from?: string;
  to?: string;
  userId?: string;
  departmentId?: string;
}

export interface MonthlyReportFilter {
  month?: number;
  year?: number;
  departmentId?: string;
}

export interface ExportOverviewData {
  period: string;
  department: string;
  totalUsers: number;
  totalShifts: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedAbsenceCount: number;
  overallAttendanceRate: number;
  approvedLeaveDays: number;
  exportedAt: string;
}

export interface AttendanceDetailExportItem {
  stt: number;
  employeeId: string;
  fullName: string;
  departmentName: string;
  date: string;
  weekday: string;
  shiftName: string;
  scheduledTime: string;
  checkInTime: string;
  checkOutTime: string;
  status: string;
  statusCode: string;
  lateEarlyMinutes: string;
  method: string;
  gpsCoordinates: string;
  notes: string;
}

export interface LeaveRequestExportItem {
  stt: number;
  requestId: string;
  fullName: string;
  departmentName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: string;
  statusCode: string;
  approver: string;
  approvalNote: string;
}

export interface StaffStatExportItem {
  stt: number;
  employeeId: string;
  fullName: string;
  email: string;
  departmentName: string;
  role: string;
  totalShifts: number;
  onTime: number;
  late: number;
  early: number;
  absent: number;
  excused: number;
  attendanceRate: number;
}

export interface DailyStatExportItem {
  stt: number;
  date: string;
  weekday: string;
  totalShifts: number;
  onTime: number;
  late: number;
  early: number;
  absent: number;
  excused: number;
  attendanceRate: number;
}

export interface ExportReportResponse {
  overview: ExportOverviewData;
  attendanceLogs: AttendanceDetailExportItem[];
  leaveRequests: LeaveRequestExportItem[];
  staffStats: StaffStatExportItem[];
  dailyStats: DailyStatExportItem[];
}

export interface ExportReportFilter {
  month?: number;
  year?: number;
  from?: string;
  to?: string;
  departmentId?: string;
  userId?: string;
}

export const reportService = {
  /**
   * Lấy báo cáo thống kê chấm công tổng hợp
   */
  getAttendanceReport: async (params?: AttendanceReportFilter): Promise<ApiResponse<AttendanceReportData>> => {
    return (await axiosClient.get('/reports/attendance', { params })) as unknown as ApiResponse<AttendanceReportData>;
  },

  /**
   * Lấy báo cáo chấm công chi tiết theo tháng
   */
  getMonthlyReport: async (params?: MonthlyReportFilter): Promise<ApiResponse<MonthlyReportResponse>> => {
    return (await axiosClient.get('/reports/monthly', { params })) as unknown as ApiResponse<MonthlyReportResponse>;
  },

  /**
   * Lấy toàn bộ dữ liệu 5 sheet phục vụ xuất báo cáo Excel
   */
  getExportData: async (params?: ExportReportFilter): Promise<ApiResponse<ExportReportResponse>> => {
    return (await axiosClient.get('/reports/export-data', { params })) as unknown as ApiResponse<ExportReportResponse>;
  },
};

export default reportService;

