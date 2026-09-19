import { axiosClient } from '../api/axiosClient';
import { AuthResponse, LoginPayload, User } from '../types';

export const authService = {
  /**
   * Đăng nhập hệ thống (POST /api/auth/login)
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await axiosClient.post<unknown, AuthResponse>('/auth/login', payload);
    return response;
  },

  /**
   * Yêu cầu mã OTP đặt lại mật khẩu (POST /api/auth/forgot-password)
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string; data?: { email: string; expiresIn: string } }> {
    const response = await axiosClient.post<unknown, { success: boolean; message: string; data?: { email: string; expiresIn: string } }>('/auth/forgot-password', { email });
    return response;
  },

  /**
   * Xác thực OTP và đặt lại mật khẩu mới (POST /api/auth/reset-password)
   */
  async resetPassword(payload: { email: string; otp: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const response = await axiosClient.post<unknown, { success: boolean; message: string }>('/auth/reset-password', payload);
    return response;
  },

  /**
   * Lấy thông tin người dùng hiện tại (GET /api/auth/me)
   */
  async getMe(): Promise<User> {
    const response = await axiosClient.get<unknown, { success: boolean; data: User }>('/auth/me');
    return response.data;
  },

  /**
   * Đăng xuất hệ thống (POST /api/auth/logout)
   */
  async logout(): Promise<void> {
    await axiosClient.post('/auth/logout');
  },

  /**
   * Đổi mật khẩu cho tài khoản đang đăng nhập (PUT /api/auth/change-password)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return (await axiosClient.put('/auth/change-password', {
      currentPassword,
      newPassword,
    })) as unknown as { success: boolean; message: string };
  },

  /**
   * Cập nhật ảnh đại diện / ảnh mẫu khuôn mặt (PUT /api/auth/avatar)
   */
  async updateAvatar(avatar: string, faceDescriptor?: number[]): Promise<{ success: boolean; data: User; message: string }> {
    return (await axiosClient.put('/auth/avatar', {
      avatar,
      faceDescriptor,
    })) as unknown as { success: boolean; data: User; message: string };
  },
};

export default authService;
