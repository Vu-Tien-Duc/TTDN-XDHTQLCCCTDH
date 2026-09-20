import { axiosClient } from '../api/axiosClient';
import { Role, User } from '../types';

export interface UserQueryParams {
  role?: Role;
  departmentId?: string;
  isActive?: boolean;
  search?: string;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  departmentId: string;
  annualLeaveQuota?: number;
}

export interface UpdateUserPayload {
  fullName?: string;
  departmentId?: string;
  role?: Role;
  isActive?: boolean;
  annualLeaveQuota?: number;
}

export const userService = {
  /**
   * Lấy danh sách người dùng (Admin xem toàn bộ, Trưởng khoa xem theo khoa)
   * GET /api/users
   */
  async getAllUsers(params?: UserQueryParams): Promise<User[]> {
    const res = await axiosClient.get<unknown, { success: boolean; data: User[] }>('/users', {
      params,
    });
    return res.data;
  },

  /**
   * Alias cho getAllUsers
   */
  async getUsers(params?: UserQueryParams): Promise<User[]> {
    return this.getAllUsers(params);
  },

  /**
   * Lấy chi tiết người dùng theo ID
   * GET /api/users/:id
   */
  async getUserById(id: string): Promise<User> {
    const res = await axiosClient.get<unknown, { success: boolean; data: User }>(`/users/${id}`);
    return res.data;
  },

  /**
   * Tạo người dùng mới (Chỉ Admin)
   * POST /api/users
   */
  async createUser(payload: CreateUserPayload): Promise<User> {
    const res = await axiosClient.post<unknown, { success: boolean; data: User }>('/users', payload);
    return res.data;
  },

  /**
   * Cập nhật thông tin người dùng (Admin hoặc Trưởng khoa)
   * PUT /api/users/:id
   */
  async updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
    const res = await axiosClient.put<unknown, { success: boolean; data: User }>(`/users/${id}`, payload);
    return res.data;
  },

  /**
   * Vô hiệu hóa người dùng (Soft Delete: isActive = false) (Chỉ Admin)
   * DELETE /api/users/:id
   */
  async deleteUser(id: string): Promise<void> {
    await axiosClient.delete(`/users/${id}`);
  },
};

export default userService;
