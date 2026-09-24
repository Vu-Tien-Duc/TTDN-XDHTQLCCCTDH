import { axiosClient } from './axiosClient';
import { ApiResponse, AttendanceLog, PaginatedResponse, Schedule } from '../types';

export interface CheckInPayload {
  scheduleId?: string;
  shiftId?: string;
  method?: 'manual' | 'face' | 'qr' | 'gps' | 'fingerprint';
  deviceId?: string;
  deviceInfo?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  note?: string;
}

export interface CheckOutPayload {
  attendanceId?: string;
  shiftId?: string;
  method?: 'manual' | 'face' | 'qr' | 'gps' | 'fingerprint';
  deviceId?: string;
  deviceInfo?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  note?: string;
}

export interface GetAttendanceHistoryParams {
  userId?: string;
  departmentId?: string;
  status?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AttendanceHistoryResponse {
  total: number;
  page: number;
  totalPages: number;
  records: AttendanceLog[];
}

export interface FaceCheckInOptions {
  faceDescriptor?: number[];
  faceDescriptors?: number[][];
  kioskKey?: string;
  mode?: 'auto' | 'check_in' | 'check_out';
  timeoutMs?: number;
  signal?: AbortSignal;
  capturedImage?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

const DEFAULT_KIOSK_KEY = (import.meta as any).env?.VITE_KIOSK_KEY || 'kiosk_secret_key_university_2026';

export const attendanceApi = {
  /**
   * Điểm danh Check-in ca học / ca làm việc hiện tại
   * POST /api/attendance/check-in
   */
  checkIn: async (data?: CheckInPayload): Promise<ApiResponse<AttendanceLog>> => {
    return axiosClient.post('/attendance/check-in', data || { method: 'manual' });
  },

  /**
   * Kết thúc ca Check-out
   * POST /api/attendance/check-out
   */
  checkOut: async (data?: CheckOutPayload): Promise<ApiResponse<AttendanceLog>> => {
    return axiosClient.post('/attendance/check-out', data || { method: 'manual' });
  },

  /**
   * Lấy lịch làm việc / ca dạy hôm nay của chính mình
   * GET /api/schedules/today
   */
  getTodaySchedules: async (): Promise<ApiResponse<{ total: number; checkedDate: string; schedules: Schedule[] }>> => {
    return axiosClient.get('/schedules/today');
  },

  /**
   * Xem lịch sử chấm công (có phân quyền và lọc ngày, trạng thái)
   * GET /api/attendance/history
   */
  getHistory: async (params?: GetAttendanceHistoryParams): Promise<ApiResponse<AttendanceHistoryResponse>> => {
    return axiosClient.get('/attendance/history', { params });
  },

  /**
   * Đăng ký vector khuôn mặt (hỗ trợ cả đơn vector và đa vector 3 góc)
   * POST /api/users/:id/face-descriptor
   */
  registerFaceDescriptor: async (
    userId: string,
    descriptorData: number[] | number[][],
    options?: { force?: boolean }
  ): Promise<ApiResponse<{ userId: string; fullName: string; email: string; faceRegistered: boolean; samplesCount?: number }>> => {
    const payload: any = Array.isArray(descriptorData[0])
      ? { faceDescriptors: descriptorData }
      : { faceDescriptor: descriptorData };
    if (options?.force) {
      payload.force = true;
    }
    return axiosClient.post(`/users/${userId}/face-descriptor`, payload);
  },

  /**
   * Xóa dữ liệu Face ID của người dùng
   * DELETE /api/users/:id/face-descriptor
   */
  deleteFaceDescriptor: async (
    userId: string
  ): Promise<ApiResponse<{ userId: string; fullName: string; faceRegistered: boolean }>> => {
    return axiosClient.delete(`/users/${userId}/face-descriptor`);
  },

  /**
   * Điểm danh khuôn mặt Kiosk (hỗ trợ cả object params hoặc truyền rời, kèm timeout 5s)
   * POST /api/attendance/face-checkin
   */
  faceCheckIn: async (
    optionsOrDescriptor: number[] | FaceCheckInOptions,
    legacyKioskKey?: string,
    legacyMode: 'auto' | 'check_in' | 'check_out' = 'auto'
  ): Promise<ApiResponse<any>> => {
    let faceDescriptor: number[] = [];
    let kioskKey = legacyKioskKey || DEFAULT_KIOSK_KEY;
    let mode = legacyMode;
    let location: { lat: number; lng: number } | undefined;
    let signal: AbortSignal | undefined;
    let capturedImage: string | undefined;

    if (Array.isArray(optionsOrDescriptor)) {
      faceDescriptor = optionsOrDescriptor;
    } else {
      faceDescriptor = optionsOrDescriptor.faceDescriptor || [];
      kioskKey = optionsOrDescriptor.kioskKey || DEFAULT_KIOSK_KEY;
      mode = optionsOrDescriptor.mode || 'auto';
      signal = optionsOrDescriptor.signal;
      location = optionsOrDescriptor.location;
      capturedImage = optionsOrDescriptor.capturedImage;
    }

    return axiosClient.post(
      '/attendance/face-checkin',
      { faceDescriptor, mode, location, capturedImage },
      {
        headers: {
          'x-kiosk-key': kioskKey,
          'x-device-id': 'KIOSK_MAIN_HALL_01',
        },
        timeout: 5000,
        signal,
      }
    );
  },

  /**
   * Điểm danh khuôn mặt Kiosk cho nhiều mô tả (batch, kèm timeout 5s)
   * POST /api/attendance/face-checkin-batch
   */
  faceCheckInBatch: async (
    faceDescriptors: number[][],
    kioskKey: string = DEFAULT_KIOSK_KEY,
    mode: 'auto' | 'check_in' | 'check_out' = 'auto',
    signal?: AbortSignal
  ): Promise<ApiResponse<any>> => {
    return axiosClient.post(
      '/attendance/face-checkin-batch',
      { faceDescriptors, mode },
      {
        headers: {
          'x-kiosk-key': kioskKey,
          'x-device-id': 'KIOSK_MAIN_HALL_01',
        },
        timeout: 5000,
        signal,
      }
    );
  },

  /**
   * Sinh mã QR Động phục vụ Kiosk / Giảng đường (TOTP 20s)
   * GET /api/attendance/qr/generate
   */
  generateQRCode: async (params?: { roomId?: string; subjectCode?: string }): Promise<ApiResponse<any>> => {
    return axiosClient.get('/attendance/qr/generate', { params });
  },

  /**
   * Quét mã QR Động trên điện thoại để điểm danh
   * POST /api/attendance/qr/scan
   */
  scanQRCode: async (data: {
    qrToken: string;
    location?: { lat: number; lng: number; accuracy?: number };
    accuracy?: number;
    deviceId?: string;
  }): Promise<ApiResponse<any>> => {
    return axiosClient.post('/attendance/qr/scan', data);
  },

  /**
   * Lấy danh sách người dùng kèm cờ đã đăng ký khuôn mặt
   * GET /api/users
   */
  getUsers: async (params?: { role?: string; departmentId?: string; search?: string; page?: number; limit?: number }): Promise<ApiResponse<any>> => {
    return axiosClient.get('/users', { params });
  },

  /**
   * Lấy thông số cấu hình vị trí thực tế của trường (Geofence)
   * GET /api/attendance/campus-config
   */
  getCampusConfig: async (): Promise<ApiResponse<any>> => {
    return axiosClient.get('/attendance/campus-config');
  },

  /**
   * Cập nhật vị trí thực tế của trường (Căn chỉnh theo GPS thật)
   * POST /api/attendance/campus-config
   */
  updateCampusConfig: async (data: {
    name?: string;
    lat: number;
    lng: number;
    radiusMeters?: number;
  }): Promise<ApiResponse<any>> => {
    return axiosClient.post('/attendance/campus-config', data);
  },

  /**
   * [Admin] Điều chỉnh bản ghi chấm công (Duyệt phép, sửa giờ, sửa trạng thái)
   * PUT /api/attendance/:id
   */
  updateAttendanceByAdmin: async (
    id: string,
    data: {
      status?: AttendanceStatus;
      checkInTime?: string | null;
      checkOutTime?: string | null;
      leaveRequestId?: string | null;
    }
  ): Promise<ApiResponse<{ updatedLog: AttendanceLog; previousData: any }>> => {
    return axiosClient.put(`/attendance/${id}`, data);
  },
};

export default attendanceApi;
