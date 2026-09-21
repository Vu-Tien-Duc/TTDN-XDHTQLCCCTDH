import { axiosClient } from '../api/axiosClient';
import { Department } from '../types';

export interface DepartmentPayload {
  name: string;
  type: 'khoa' | 'bomon' | 'phongban';
  parentId?: string | null;
  managerId?: string | null;
  location?: {
    lat?: number;
    lng?: number;
  };
}

export const departmentService = {
  /**
   * Lấy danh sách cây cấu trúc Khoa / Bộ môn / Phòng ban
   * GET /api/departments/tree (hoặc GET /api/departments?tree=true)
   */
  async getDepartmentTree(): Promise<Department[]> {
    const res = await axiosClient.get<unknown, { success: boolean; data: Department[] }>('/departments/tree');
    return res.data;
  },

  /**
   * Lấy danh sách phẳng tất cả phòng ban
   * GET /api/departments?tree=false
   */
  async getAllDepartments(params?: { type?: string; parentId?: string }): Promise<Department[]> {
    const res = await axiosClient.get<unknown, { success: boolean; data: Department[] }>('/departments', {
      params: { ...params, tree: 'false' },
    });
    return res.data;
  },

  /**
   * Alias cho getAllDepartments
   */
  async getDepartments(params?: { type?: string; parentId?: string }): Promise<Department[]> {
    return this.getAllDepartments(params);
  },

  /**
   * Lấy thông tin chi tiết một phòng ban
   * GET /api/departments/:id
   */
  async getDepartmentById(id: string): Promise<Department> {
    const res = await axiosClient.get<unknown, { success: boolean; data: Department }>(`/departments/${id}`);
    return res.data;
  },

  /**
   * Tạo mới Khoa / Bộ môn / Phòng ban (Admin)
   * POST /api/departments
   */
  async createDepartment(payload: DepartmentPayload): Promise<Department> {
    const res = await axiosClient.post<unknown, { success: boolean; data: Department }>('/departments', payload);
    return res.data;
  },

  /**
   * Cập nhật thông tin Khoa / Bộ môn / Phòng ban (Chỉ Admin)
   * PUT /api/departments/:id
   */
  async updateDepartment(id: string, payload: Partial<DepartmentPayload>): Promise<Department> {
    const res = await axiosClient.put<unknown, { success: boolean; data: Department }>(`/departments/${id}`, payload);
    return res.data;
  },

  /**
   * Xóa Khoa / Bộ môn (Admin)
   * DELETE /api/departments/:id
   */
  async deleteDepartment(id: string): Promise<void> {
    await axiosClient.delete(`/departments/${id}`);
  },
};

export default departmentService;
