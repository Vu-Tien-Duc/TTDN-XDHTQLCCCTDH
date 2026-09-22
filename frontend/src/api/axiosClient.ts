import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../utils';

// Khởi tạo axios instance với baseURL trỏ qua proxy và bật gửi cookie
export const axiosClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Bắt buộc để gửi và nhận httpOnly cookie chứa Refresh Token
});

// Trạng thái cho hàng đợi khi Refresh Token đang diễn ra
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: Tự động gắn Access Token vào Header
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Nếu phiên làm việc đã hết hạn do không hoạt động quá lâu -> chặn request ngay
    if (tokenStorage.isSessionExpired()) {
      tokenStorage.clear();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Phiên làm việc đã hết hạn do không hoạt động.'));
    }

    const token = tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 2. Response Interceptor: Bắt lỗi 401 và tự động gọi /api/auth/refresh
axiosClient.interceptors.response.use(
  (response) => {
    // Cập nhật timestamp hoạt động khi có request thành công
    tokenStorage.updateActivity();
    return response.data; // Trả về data trực tiếp theo chuẩn { success, data, message }
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Nếu không có response hoặc mã không phải 401 thì từ chối ngay
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Nếu là các API xác thực cơ bản (login, register, forgot-password...) thì từ chối ngay để hiển thị thông báo lỗi (ví dụ: sai mật khẩu)
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/forgot-password') ||
      originalRequest.url?.includes('/auth/reset-password')
    ) {
      return Promise.reject(error);
    }

    // Nếu phiên làm việc đã hết hạn do không hoạt động quá lâu -> không cố refresh mà xóa và redirect login ngay
    if (tokenStorage.isSessionExpired()) {
      tokenStorage.clear();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Nếu người dùng hoàn toàn chưa có token/refreshToken nào thì không cố refresh
    const hasAnyToken = !!tokenStorage.getAccessToken();
    if (!hasAnyToken) {
      return Promise.reject(error);
    }

    // Nếu chính request gọi refresh mà bị 401 -> phiên hết hạn hoàn toàn
    if (originalRequest.url?.includes('/auth/refresh')) {
      tokenStorage.clear();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Đánh dấu request này đang được retry để tránh lặp vô tận
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Nếu một request khác đang refresh, đưa request này vào hàng đợi
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return axiosClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Gọi API refresh token (Backend đọc refresh token từ httpOnly cookie hoặc body)
      const res = await axios.post<{
        success: boolean;
        data?: { token?: string; accessToken?: string };
        token?: string;
        accessToken?: string;
      }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true }
      );

      const newToken =
        res.data?.data?.token ||
        res.data?.data?.accessToken ||
        res.data?.token ||
        res.data?.accessToken;

      if (!newToken) {
        throw new Error('Không nhận được Access Token mới sau khi refresh.');
      }

      // Lưu lại access token mới vào storage
      tokenStorage.setAccessToken(newToken);

      // Giải phóng hàng đợi các request bị hoãn
      processQueue(null, newToken);

      // Gắn token mới và thực thi lại request ban đầu
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }

      return axiosClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosClient;
