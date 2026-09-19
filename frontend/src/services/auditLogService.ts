import { axiosClient } from '../api/axiosClient';

export interface AuditLogItem {
  _id: string;
  actor: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  };
  action: string;
  targetId: string;
  targetType: string;
  ipAddress?: string;
  timestamp: string;
  details?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogFilterParams {
  actor?: string;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  totalRecords: number;
  logs: AuditLogItem[];
}

export const auditLogService = {
  /**
   * Lấy danh sách nhật ký kiểm toán hệ thống (Chỉ Admin)
   * GET /api/audit-logs
   */
  async getAuditLogs(params?: AuditLogFilterParams): Promise<AuditLogResponse> {
    const res = await axiosClient.get<unknown, { success: boolean; data: AuditLogResponse }>(
      '/audit-logs',
      { params }
    );
    return res.data;
  },
};

export default auditLogService;
