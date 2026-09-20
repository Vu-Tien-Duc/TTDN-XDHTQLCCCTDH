import { axiosClient } from '../api/axiosClient';
import { ApiResponse, LeaveRequest, LeaveType } from '../types';

export interface CreateLeavePayload {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
}

export interface LeaveBalanceData {
  userId: string;
  year: number;
  annualLeaveQuota: number;
  daysUsed: number;
  pendingDays?: number;
  remainingDays: number;
  isAdmin?: boolean;
}

export interface LeaveFilterParams {
  status?: string;
  type?: string;
  userId?: string;
}

export const leaveService = {
  /**
   * Tạo đơn xin nghỉ phép / dạy bù / đổi ca (gửi JSON)
   */
  createLeaveRequest: async (payload: CreateLeavePayload): Promise<ApiResponse<LeaveRequest>> => {
    return (await axiosClient.post('/leave-requests', payload)) as unknown as ApiResponse<LeaveRequest>;
  },

  /**
   * Tạo đơn với form-data (gửi kèm file trực tiếp)
   */
  createLeaveWithFile: async (formData: FormData): Promise<ApiResponse<LeaveRequest>> => {
    return (await axiosClient.post('/leave-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })) as unknown as ApiResponse<LeaveRequest>;
  },

  /**
   * Tải file minh chứng lên server
   */
  uploadAttachment: async (
    file: File
  ): Promise<ApiResponse<{ originalName: string; filename: string; mimetype: string; size: number; fileUrl: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return (await axiosClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })) as unknown as ApiResponse<{ originalName: string; filename: string; mimetype: string; size: number; fileUrl: string }>;
  },

  /**
   * Lấy danh sách đơn nghỉ phép (hỗ trợ bộ lọc status, type, userId)
   */
  getLeaveRequests: async (params?: LeaveFilterParams): Promise<ApiResponse<LeaveRequest[]>> => {
    return (await axiosClient.get('/leave-requests', { params })) as unknown as ApiResponse<LeaveRequest[]>;
  },

  /**
   * Lấy chi tiết một đơn
   */
  getLeaveRequestById: async (id: string): Promise<ApiResponse<LeaveRequest>> => {
    return (await axiosClient.get(`/leave-requests/${id}`)) as unknown as ApiResponse<LeaveRequest>;
  },

  /**
   * Xem số dư ngày phép hiện tại trong năm
   */
  getLeaveBalance: async (userId?: string): Promise<ApiResponse<LeaveBalanceData>> => {
    return (await axiosClient.get('/leave-requests/balance', {
      params: userId ? { userId } : undefined,
    })) as unknown as ApiResponse<LeaveBalanceData>;
  },

  /**
   * Phê duyệt đơn (Trưởng khoa hoặc Admin)
   */
  approveLeaveRequest: async (id: string, approvalNote?: string): Promise<ApiResponse<LeaveRequest>> => {
    return (await axiosClient.put(`/leave-requests/${id}/approve`, {
      approvalNote: approvalNote || '',
    })) as unknown as ApiResponse<LeaveRequest>;
  },

  /**
   * Từ chối đơn (bắt buộc kèm rejectionReason)
   */
  rejectLeaveRequest: async (id: string, rejectionReason: string): Promise<ApiResponse<LeaveRequest>> => {
    return (await axiosClient.put(`/leave-requests/${id}/reject`, {
      rejectionReason,
    })) as unknown as ApiResponse<LeaveRequest>;
  },
};

export default leaveService;
