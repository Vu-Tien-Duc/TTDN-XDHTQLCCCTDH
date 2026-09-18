import { axiosClient } from '../api/axiosClient';
import { ShiftConfig } from '../types';

export interface ShiftPayload {
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  lateThresholdMinutes: number;
  earlyExitThresholdMinutes?: number;
  isActive?: boolean;
}

export const shiftService = {
  /**
   * Lấy danh sách ca làm việc chuẩn
   * GET /api/shifts
   */
  async getAllShifts(): Promise<ShiftConfig[]> {
    const res = await axiosClient.get<unknown, { success: boolean; data: ShiftConfig[] }>('/shifts');
    return res.data;
  },

  /**
   * Lấy chi tiết ca làm việc theo ID
   * GET /api/shifts/:id
   */
  async getShiftById(id: string): Promise<ShiftConfig> {
    const res = await axiosClient.get<unknown, { success: boolean; data: ShiftConfig }>(`/shifts/${id}`);
    return res.data;
  },

  /**
   * Tạo ca làm việc mới (Chỉ Admin)
   * POST /api/shifts
   */
  async createShift(payload: ShiftPayload): Promise<ShiftConfig> {
    const res = await axiosClient.post<unknown, { success: boolean; data: ShiftConfig }>('/shifts', payload);
    return res.data;
  },

  /**
   * Cập nhật thông tin ca làm việc (Chỉ Admin)
   * PUT /api/shifts/:id
   */
  async updateShift(id: string, payload: Partial<ShiftPayload>): Promise<ShiftConfig> {
    const res = await axiosClient.put<unknown, { success: boolean; data: ShiftConfig }>(`/shifts/${id}`, payload);
    return res.data;
  },

  /**
   * Xóa ca làm việc (Chỉ Admin)
   * DELETE /api/shifts/:id
   */
  async deleteShift(id: string): Promise<void> {
    await axiosClient.delete(`/shifts/${id}`);
  },
};

export default shiftService;
