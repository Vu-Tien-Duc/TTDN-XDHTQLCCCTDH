/**
 * Bảng mã lỗi chuẩn hóa cho toàn bộ hệ thống (Error Codes)
 * Thống nhất chung giữa 3 thành viên theo kế hoạch Tuần 1.
 */
const ERROR_CODES = {
  // === AUTH & USER (TV A) ===
  AUTH_UNAUTHORIZED: 'AUTH_001',          // Chưa đăng nhập hoặc thiếu token
  AUTH_TOKEN_INVALID: 'AUTH_002',         // Token không hợp lệ hoặc hết hạn
  AUTH_INVALID_CREDENTIALS: 'AUTH_003',   // Sai email hoặc mật khẩu
  AUTH_FORBIDDEN: 'AUTH_004',             // Không có quyền truy cập
  AUTH_USER_INACTIVE: 'AUTH_005',         // Tài khoản bị vô hiệu hóa
  USER_NOT_FOUND: 'USER_001',             // Không tìm thấy người dùng
  USER_EMAIL_EXISTS: 'USER_002',          // Email đã tồn tại

  // === SHIFT CONFIG (TV B) ===
  SHIFT_NOT_FOUND: 'SHIFT_001',           // Không tìm thấy ca làm việc
  SHIFT_IN_USE: 'SHIFT_002',              // Ca đang được sử dụng trong lịch, không thể xóa
  SHIFT_INVALID_DATA: 'SHIFT_003',        // Dữ liệu ca làm việc không hợp lệ
  SHIFT_DUPLICATE: 'SHIFT_004',           // Ca làm việc đã tồn tại (trùng tên hoặc khung giờ)

  // === SCHEDULE (TV B) ===
  SCHEDULE_NOT_FOUND: 'SCHEDULE_001',     // Không tìm thấy lịch giảng dạy/công tác
  SCHEDULE_CONFLICT: 'SCHEDULE_002',      // Trùng lịch với ca khác cùng ngày trong học kỳ
  SCHEDULE_INVALID_DATA: 'SCHEDULE_003',  // Dữ liệu phân lịch không hợp lệ (thiếu trường, ngày sai)

  // === ATTENDANCE (TV B - Tuần 2 & Schema Tuần 1) ===
  ATTENDANCE_NOT_FOUND: 'ATTENDANCE_001', // Không tìm thấy bản ghi chấm công
  ATTENDANCE_ALREADY_EXISTS: 'ATTENDANCE_002', // Đã check-in ca này rồi
  ATTENDANCE_NO_OPEN_RECORD: 'ATTENDANCE_003', // Không tìm thấy ca mở để check-out
  ATTENDANCE_NO_MATCHING_SCHEDULE: 'ATTENDANCE_004', // Không có lịch phù hợp hiện tại để check-in

  // === DEPARTMENT (TV A) ===
  DEPT_NOT_FOUND: 'DEPT_001',
  DEPT_HAS_CHILDREN_OR_USERS: 'DEPT_002',

  // === LEAVE REQUEST (TV C) ===
  LEAVE_NOT_FOUND: 'LEAVE_001',
  LEAVE_INVALID_DATES: 'LEAVE_002',
  LEAVE_ALREADY_PROCESSED: 'LEAVE_003',
};

module.exports = ERROR_CODES;
