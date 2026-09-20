import {
  attendanceApi,
  CheckInPayload,
  CheckOutPayload,
  GetAttendanceHistoryParams as AttendanceHistoryParams,
  AttendanceHistoryResponse,
} from '../api/attendanceApi';
import { axiosClient } from '../api/axiosClient';
import { AttendanceLog } from '../types';

export type { CheckInPayload, CheckOutPayload, AttendanceHistoryParams, AttendanceHistoryResponse };

export const attendanceService = {
  ...attendanceApi,

  /**
   * Lấy lịch sử chấm công với bộ lọc và phân trang (unwrapped data)
   */
  async getAttendanceHistory(params?: AttendanceHistoryParams): Promise<AttendanceHistoryResponse> {
    const res = await attendanceApi.getHistory(params);
    return res.data;
  },

  /**
   * Thực hiện Check-in thủ công (unwrapped data)
   */
  async checkIn(payload: CheckInPayload = {}): Promise<AttendanceLog> {
    const res = await attendanceApi.checkIn(payload);
    return res.data;
  },

  /**
   * Thực hiện Check-out (unwrapped data)
   */
  async checkOut(payload: CheckOutPayload = {}): Promise<AttendanceLog> {
    const res = await attendanceApi.checkOut(payload);
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
