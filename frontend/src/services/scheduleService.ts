import { axiosClient } from '../api/axiosClient';
import { Schedule } from '../types';

export interface ScheduleFilterParams {
  userId?: string;
  shiftId?: string;
  weekday?: number;
  startDate?: string;
  endDate?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export interface CreateSchedulePayload {
  userId: string;
  shiftId: string;
  weekday: number; // 0 - 6
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  roomId?: string;
  subjectName?: string;
  subjectCode?: string;
  isRecurring?: boolean;
}

export interface UpdateSchedulePayload {
  userId?: string;
  shiftId?: string;
  weekday?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  roomId?: string;
  subjectName?: string;
  subjectCode?: string;
  isRecurring?: boolean;
}

export interface TodaySchedulesResponse {
  total: number;
  checkedDate: string;
  schedules: Schedule[];
}

export const scheduleService = {
  /**
   * Lấy danh sách lịch phân công giảng dạy / công tác
   * GET /api/schedules
   */
  async getSchedules(params?: ScheduleFilterParams): Promise<Schedule[]> {
    const res = await axiosClient.get<unknown, { success: boolean; data: Schedule[] | { schedules: Schedule[] } }>('/schedules', {
      params,
    });
    
    // Backend có thể trả về array trực tiếp hoặc đối tượng phân trang { schedules: [...] }
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data && Array.isArray((res.data as { schedules: Schedule[] }).schedules)) {
      return (res.data as { schedules: Schedule[] }).schedules;
    }
    return [];
  },

  /**
   * Lấy danh sách lịch phân công có hiệu lực trong ngày
   * GET /api/schedules/today
   */
  async getTodaySchedules(params?: { date?: string; userId?: string }): Promise<TodaySchedulesResponse> {
    const res = await axiosClient.get<unknown, { success: boolean; data: TodaySchedulesResponse }>('/schedules/today', {
      params,
    });
    return res.data;
  },

  /**
   * Lấy chi tiết 1 lịch theo ID
   * GET /api/schedules/:id
   */
  async getScheduleById(id: string): Promise<Schedule> {
    const res = await axiosClient.get<unknown, { success: boolean; data: Schedule }>(`/schedules/${id}`);
    return res.data;
  },

  /**
   * Tạo lịch phân công mới (Admin / Trưởng khoa)
   * POST /api/schedules
   */
  async createSchedule(payload: CreateSchedulePayload): Promise<Schedule> {
    const res = await axiosClient.post<unknown, { success: boolean; data: Schedule }>('/schedules', payload);
    return res.data;
  },

  /**
   * Cập nhật lịch phân công (Admin / Trưởng khoa)
   * PUT /api/schedules/:id
   */
  async updateSchedule(id: string, payload: UpdateSchedulePayload): Promise<Schedule> {
    const res = await axiosClient.put<unknown, { success: boolean; data: Schedule }>(`/schedules/${id}`, payload);
    return res.data;
  },

  /**
   * Xóa lịch phân công (Admin / Trưởng khoa)
   * DELETE /api/schedules/:id
   */
  async deleteSchedule(id: string): Promise<void> {
    await axiosClient.delete(`/schedules/${id}`);
  },
};

export default scheduleService;
