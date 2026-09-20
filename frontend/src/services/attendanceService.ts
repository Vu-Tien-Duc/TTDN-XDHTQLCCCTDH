import { axiosClient } from '../api/axiosClient';
import { AttendanceLog, AttendanceStatus } from '../types';

export interface AttendanceHistoryParams {
  page?: number;
  limit?: number;
  userId?: string;
  departmentId?: string;
  status?: AttendanceStatus;
  from?: string;
  to?: string;
}

export interface AttendanceHistoryResponse {
  total: number;
  page: number;
  totalPages: number;
  records: AttendanceLog[];
}

export interface CheckInPayload {
  scheduleId?: string;
  shiftId?: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  note?: string;
}

export interface CheckOutPayload {
  attendanceId?: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  note?: string;
}

export const attendanceService = {
  /**
   * Lấy lịch sử chấm công với bộ lọc và phân trang
   * GET /api/attendance/history
   */
  async getAttendanceHistory(params?: AttendanceHistoryParams): Promise<AttendanceHistoryResponse> {
    const res = await axiosClient.get<unknown, { success: boolean; data: AttendanceHistoryResponse }>(
      '/attendance/history',
      { params }
    );
    return res.data;
  },

  /**
   * Thực hiện Check-in thủ công
   * POST /api/attendance/check-in
   */
  async checkIn(payload: CheckInPayload = {}): Promise<AttendanceLog> {
    const res = await axiosClient.post<unknown, { success: boolean; data: AttendanceLog }>(
      '/attendance/check-in',
      payload
    );
    return res.data;
  },

  /**
   * Thực hiện Check-out
   * POST /api/attendance/check-out
   */
  async checkOut(payload: CheckOutPayload = {}): Promise<AttendanceLog> {
    const res = await axiosClient.post<unknown, { success: boolean; data: AttendanceLog }>(
      '/attendance/check-out',
      payload
    );
    return res.data;
  },

  /**
   * Xem chi tiết 1 bản ghi chấm công
   * GET /api/attendance/:id
   */
  async getAttendanceById(id: string): Promise<AttendanceLog> {
    const res = await axiosClient.get<unknown, { success: boolean; data: AttendanceLog }>(
      `/attendance/${id}`
    );
    return res.data;
  },
};

export default attendanceService;
