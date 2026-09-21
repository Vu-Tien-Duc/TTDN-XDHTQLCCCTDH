import { axiosClient } from '../api/axiosClient';
import { ApiResponse } from '../types';

export interface WeeklyTrendItem {
  label: string;
  subLabel?: string;
  rate: number;
  lateRate: number;
  total: number;
  onTime: number;
  late: number;
}

export interface AttendanceReportData {
  totalRecords: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  excusedAbsenceCount: number;
  approvedLeaveDays: number;
  weeklyTrend?: WeeklyTrendItem[];
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

export interface MonthlyReportResponse {
  month: number;
  year: number;
  totalUsers: number;
  report: MonthlyStaffReportItem[];
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
};

export default reportService;
