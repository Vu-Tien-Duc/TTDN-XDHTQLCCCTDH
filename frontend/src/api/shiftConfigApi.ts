import { axiosClient } from './axiosClient';
import { ApiResponse, ShiftConfig } from '../types';

export interface CreateShiftPayload {
  name: string;
  startTime: string; // Format HH:mm (e.g. "07:00")
  endTime: string;   // Format HH:mm (e.g. "11:30")
  lateThresholdMinutes?: number;
  earlyExitThresholdMinutes?: number;
}

export interface UpdateShiftPayload {
  name?: string;
  startTime?: string;
  endTime?: string;
  lateThresholdMinutes?: number;
  earlyExitThresholdMinutes?: number;
  isActive?: boolean;
}

export const shiftConfigApi = {
  /**
   * Lấy toàn bộ danh sách cấu hình ca làm việc
   */
  getAll: async (): Promise<ApiResponse<ShiftConfig[]>> => {
    return axiosClient.get('/shifts');
  },

  /**
   * Lấy chi tiết một ca làm việc theo ID
   */
  getById: async (id: string): Promise<ApiResponse<ShiftConfig>> => {
    return axiosClient.get(`/shifts/${id}`);
  },

  /**
   * Tạo mới ca làm việc (Chỉ Admin)
   */
  create: async (data: CreateShiftPayload): Promise<ApiResponse<ShiftConfig>> => {
    return axiosClient.post('/shifts', data);
  },

  /**
   * Cập nhật ca làm việc (Chỉ Admin)
   */
  update: async (id: string, data: UpdateShiftPayload): Promise<ApiResponse<ShiftConfig>> => {
    return axiosClient.put(`/shifts/${id}`, data);
  },

  /**
   * Xóa ca làm việc (Chỉ Admin - Ràng buộc: không có lịch dạy gắn với ca)
   */
  delete: async (id: string): Promise<ApiResponse<null>> => {
    return axiosClient.delete(`/shifts/${id}`);
  },
};
