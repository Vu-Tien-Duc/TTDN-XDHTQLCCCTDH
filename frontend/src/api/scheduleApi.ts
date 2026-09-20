import { axiosClient } from './axiosClient';
import { ApiResponse, PaginatedResponse, Schedule } from '../types';

export interface GetSchedulesParams {
  startDate?: string;
  endDate?: string;
  userId?: string;
  shiftId?: string;
  weekday?: number;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export interface CreateSchedulePayload {
  userId: string;
  shiftId: string;
  roomId?: string;
  weekday: number; // 0 (Chủ nhật) - 6 (Thứ bảy)
  isRecurring?: boolean;
  startDate: string; // ISO date or YYYY-MM-DD
  endDate: string;   // ISO date or YYYY-MM-DD
  startTime?: string;
  endTime?: string;
}

export interface UpdateSchedulePayload {
  userId?: string;
  shiftId?: string;
  roomId?: string;
  weekday?: number;
  isRecurring?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

export interface TodaySchedulesResponse {
  total: number;
  checkedDate: string;
  schedules: Schedule[];
}

export const scheduleApi = {
  /**
   * Lấy danh sách lịch giảng dạy / công tác (có lọc theo ngày, giảng viên, phân trang)
   */
  getAll: async (params?: GetSchedulesParams): Promise<ApiResponse<Schedule[]> | PaginatedResponse<Schedule>> => {
    return axiosClient.get('/schedules', { params });
  },

  /**
   * Lấy danh sách lịch giảng dạy hôm nay của người dùng đăng nhập
   */
  getToday: async (params?: { date?: string; userId?: string }): Promise<ApiResponse<TodaySchedulesResponse>> => {
    return axiosClient.get('/schedules/today', { params });
  },

  /**
   * Lấy chi tiết lịch giảng dạy theo ID
   */
  getById: async (id: string): Promise<ApiResponse<Schedule>> => {
    return axiosClient.get(`/schedules/${id}`);
  },

  /**
   * Tạo lịch giảng dạy mới (Admin / Trưởng khoa)
   */
  create: async (data: CreateSchedulePayload): Promise<ApiResponse<Schedule>> => {
    return axiosClient.post('/schedules', data);
  },

  /**
   * Cập nhật lịch giảng dạy
   */
  update: async (id: string, data: UpdateSchedulePayload): Promise<ApiResponse<Schedule>> => {
    return axiosClient.put(`/schedules/${id}`, data);
  },

  /**
   * Xóa lịch giảng dạy
   */
  delete: async (id: string): Promise<ApiResponse<null>> => {
    return axiosClient.delete(`/schedules/${id}`);
  },
};
