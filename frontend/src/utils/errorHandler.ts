import { AxiosError } from 'axios';
import toast from 'react-hot-toast';

/**
 * BẢNG ÁNH XẠ MÃ LỖI HỆ THỐNG (ERROR CODES) SANG TIẾNG VIỆT THÂN THIỆN
 * Hỗ trợ cả Error Code Name (VD: INVALID_CREDENTIALS) và Error Code Value (VD: AUTH_003)
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // --- Xác thực & Phiên làm việc (Auth) ---
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
  AUTH_INVALID_CREDENTIALS: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
  AUTH_003: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',

  AUTH_UNAUTHORIZED: 'Phiên làm việc đã hết hạn hoặc bạn chưa đăng nhập.',
  AUTH_001: 'Phiên làm việc đã hết hạn hoặc bạn chưa đăng nhập.',

  AUTH_TOKEN_INVALID: 'Mã xác thực không hợp lệ. Vui lòng đăng nhập lại.',
  AUTH_002: 'Mã xác thực không hợp lệ. Vui lòng đăng nhập lại.',

  AUTH_FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  AUTH_004: 'Bạn không có quyền thực hiện thao tác này.',

  AUTH_USER_INACTIVE: 'Tài khoản của bạn đã bị vô hiệu hóa hoặc chưa kích hoạt.',
  AUTH_005: 'Tài khoản của bạn đã bị vô hiệu hóa hoặc chưa kích hoạt.',

  USER_NOT_FOUND: 'Không tìm thấy thông tin tài khoản người dùng.',
  USER_001: 'Không tìm thấy thông tin tài khoản người dùng.',

  USER_EMAIL_EXISTS: 'Địa chỉ email này đã được sử dụng bởi một tài khoản khác.',
  USER_002: 'Địa chỉ email này đã được sử dụng bởi một tài khoản khác.',

  // --- Chấm công (Attendance) ---
  ATTENDANCE_ALREADY_EXISTS: 'Bạn đã điểm danh cho ca làm việc này hôm nay rồi.',
  ATTENDANCE_002: 'Bạn đã điểm danh cho ca làm việc này hôm nay rồi.',

  ATTENDANCE_NO_OPEN_RECORD: 'Không tìm thấy lượt điểm danh vào ca mở để thực hiện check-out.',
  ATTENDANCE_003: 'Không tìm thấy lượt điểm danh vào ca mở để thực hiện check-out.',

  ATTENDANCE_NO_MATCHING_SCHEDULE: 'Hiện tại bạn không có lịch giảng dạy hoặc công tác phù hợp để điểm danh.',
  ATTENDANCE_004: 'Hiện tại bạn không có lịch giảng dạy hoặc công tác phù hợp để điểm danh.',

  ATTENDANCE_NOT_FOUND: 'Không tìm thấy bản ghi chấm công yêu cầu.',
  ATTENDANCE_001: 'Không tìm thấy bản ghi chấm công yêu cầu.',

  // --- Lịch phân công giảng dạy (Schedule) ---
  SCHEDULE_CONFLICT: 'Trùng lịch giảng dạy với ca khác của giảng viên hoặc phòng học.',
  SCHEDULE_002: 'Trùng lịch giảng dạy với ca khác của giảng viên hoặc phòng học.',

  SCHEDULE_NOT_FOUND: 'Không tìm thấy lịch giảng dạy / công tác yêu cầu.',
  SCHEDULE_001: 'Không tìm thấy lịch giảng dạy / công tác yêu cầu.',

  SCHEDULE_INVALID_DATA: 'Thông tin phân lịch không hợp lệ (ngày kết thúc phải sau ngày bắt đầu).',
  SCHEDULE_003: 'Thông tin phân lịch không hợp lệ (ngày kết thúc phải sau ngày bắt đầu).',

  // --- Ca làm việc (Shift Config) ---
  SHIFT_NOT_FOUND: 'Không tìm thấy ca làm việc trong hệ thống.',
  SHIFT_001: 'Không tìm thấy ca làm việc trong hệ thống.',

  SHIFT_IN_USE: 'Ca làm việc đang được gắn với thời khóa biểu, không thể xóa.',
  SHIFT_002: 'Ca làm việc đang được gắn với thời khóa biểu, không thể xóa.',

  SHIFT_INVALID_DATA: 'Khung giờ ca học không hợp lệ (giờ bắt đầu phải trước giờ kết thúc).',
  SHIFT_003: 'Khung giờ ca học không hợp lệ (giờ bắt đầu phải trước giờ kết thúc).',

  SHIFT_DUPLICATE: 'Ca làm việc này đã tồn tại (trùng tên hoặc trùng khung giờ).',
  SHIFT_004: 'Ca làm việc này đã tồn tại (trùng tên hoặc trùng khung giờ).',

  // --- Cơ cấu tổ chức & Khoa phòng ban (Department) ---
  DEPT_NOT_FOUND: 'Không tìm thấy thông tin đơn vị / khoa phòng ban.',
  DEPT_001: 'Không tìm thấy thông tin đơn vị / khoa phòng ban.',

  DEPT_HAS_CHILDREN_OR_USERS: 'Đơn vị vẫn còn nhân sự hoặc đơn vị con trực thuộc, không thể xóa.',
  DEPT_002: 'Đơn vị vẫn còn nhân sự hoặc đơn vị con trực thuộc, không thể xóa.',

  // --- Đơn nghỉ phép (Leave Request) ---
  LEAVE_NOT_FOUND: 'Không tìm thấy đơn xin nghỉ phép yêu cầu.',
  LEAVE_001: 'Không tìm thấy đơn xin nghỉ phép yêu cầu.',

  LEAVE_INVALID_DATES: 'Thời gian xin nghỉ không hợp lệ hoặc vượt quá hạn mức phép còn lại.',
  LEAVE_002: 'Thời gian xin nghỉ không hợp lệ hoặc vượt quá hạn mức phép còn lại.',

  LEAVE_ALREADY_PROCESSED: 'Đơn xin nghỉ này đã được xét duyệt hoặc từ chối trước đó.',
  LEAVE_003: 'Đơn xin nghỉ này đã được xét duyệt hoặc từ chối trước đó.',
};

/**
 * Trích xuất thông báo lỗi tiếng Việt thân thiện từ Axios Error
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.'): string {
  if (!error) return fallbackMessage;

  const axiosErr = error as AxiosError<{
    errorCode?: string;
    code?: string;
    message?: string;
    error?: string;
  }>;

  if (axiosErr.response?.data) {
    const data = axiosErr.response.data;

    // 1. Kiểm tra errorCode được ánh xạ
    const code = data.errorCode || data.code;
    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code];
    }

    // 2. Nếu message trùng mã lỗi
    if (data.message && ERROR_MESSAGES[data.message]) {
      return ERROR_MESSAGES[data.message];
    }

    // 3. Trả về message từ server nếu có
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }
  }

  // Lỗi mạng hoặc server không phản hồi
  if (axiosErr.message === 'Network Error') {
    return 'Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng hoặc server backend.';
  }

  return fallbackMessage;
}

/**
 * Hiển thị Toast thông báo lỗi tiếng Việt tự động
 */
export function showErrorToast(error: unknown, fallbackMessage?: string): void {
  const msg = getErrorMessage(error, fallbackMessage);
  toast.error(msg);
}

export default {
  ERROR_MESSAGES,
  getErrorMessage,
  showErrorToast,
};
