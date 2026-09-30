import { axiosClient } from '../api/axiosClient';

export interface AuditLogItem {
  _id: string;
  actor: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  actorType?: 'USER' | 'SYSTEM';
  action: string;
  targetId: string;
  targetType: string;
  ipAddress?: string;
  timestamp: string;
  details?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  totalPages: number;
  totalDocs: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuditLogFilterParams {
  actor?: string;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  totalRecords: number;
  logs: AuditLogItem[];
  pagination?: AuditLogPagination;
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
