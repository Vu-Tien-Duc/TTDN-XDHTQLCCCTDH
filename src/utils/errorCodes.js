/**
 * BẢNG MÃ LỖI CHUẨN TOÀN HỆ THỐNG (ERROR CODES)
 * Đề tài: Xây dựng ứng dụng quản lý chấm công trường đại học
 * Thống nhất chung giữa 3 thành viên theo kế hoạch Ngày 1 - Tuần 1.
 */

const ERROR_CODES = {
  // ==========================================
  // 1. NHÓM MODULE CỦA THÀNH VIÊN B (CHÍNH)
  // ==========================================

  // --- Ca làm việc (Shift Config) ---
  SHIFT_NOT_FOUND: 'SHIFT_001',           // Không tìm thấy ca làm việc
  SHIFT_IN_USE: 'SHIFT_002',              // Ca đang được sử dụng trong lịch, không thể xóa
  SHIFT_INVALID_DATA: 'SHIFT_003',        // Dữ liệu ca làm việc không hợp lệ (giờ sai, ngưỡng trễ âm)
  SHIFT_DUPLICATE: 'SHIFT_004',           // Ca làm việc đã tồn tại (trùng tên hoặc khung giờ)

  // --- Lịch phân công giảng dạy / công tác (Schedule) ---
  SCHEDULE_NOT_FOUND: 'SCHEDULE_001',     // Không tìm thấy lịch giảng dạy/công tác
  SCHEDULE_CONFLICT: 'SCHEDULE_002',      // Trùng lịch với ca khác cùng ngày/thứ trong học kỳ
  SCHEDULE_INVALID_DATA: 'SCHEDULE_003',  // Dữ liệu phân lịch không hợp lệ (thiếu trường, ngày kết thúc < bắt đầu)

  // --- Chấm công (Attendance - Chuẩn bị cho Tuần 2) ---
  ATTENDANCE_NOT_FOUND: 'ATTENDANCE_001', // Không tìm thấy bản ghi chấm công
  ATTENDANCE_ALREADY_EXISTS: 'ATTENDANCE_002', // Đã check-in ca này rồi, không check-in trùng
  ATTENDANCE_NO_OPEN_RECORD: 'ATTENDANCE_003', // Không tìm thấy ca check-in mở để check-out
  ATTENDANCE_NO_MATCHING_SCHEDULE: 'ATTENDANCE_004', // Không có lịch phù hợp hiện tại để check-in

  // ==========================================
  // 2. NHÓM DÙNG CHUNG / LIÊN THÔNG VỚI TV A & TV C
  // ==========================================

  // --- Xác thực & Người dùng (TV A) ---
  AUTH_UNAUTHORIZED: 'AUTH_001',          // Chưa đăng nhập hoặc thiếu token
  AUTH_TOKEN_INVALID: 'AUTH_002',         // Token không hợp lệ hoặc hết hạn
  AUTH_INVALID_CREDENTIALS: 'AUTH_003',   // Sai email hoặc mật khẩu
  AUTH_FORBIDDEN: 'AUTH_004',             // Không có quyền truy cập
  AUTH_USER_INACTIVE: 'AUTH_005',         // Tài khoản bị vô hiệu hóa
  USER_NOT_FOUND: 'USER_001',             // Không tìm thấy người dùng
  USER_EMAIL_EXISTS: 'USER_002',          // Email đã tồn tại

  // --- Cơ cấu tổ chức / Khoa phòng ban (TV A) ---
  DEPT_NOT_FOUND: 'DEPT_001',             // Không tìm thấy đơn vị
  DEPT_HAS_CHILDREN_OR_USERS: 'DEPT_002', // Đơn vị còn nhân sự hoặc đơn vị con, không thể xóa

  // --- Đơn xin nghỉ / đổi ca (TV C) ---
  LEAVE_NOT_FOUND: 'LEAVE_001',           // Không tìm thấy đơn xin
  LEAVE_INVALID_DATES: 'LEAVE_002',       // Ngày xin nghỉ không hợp lệ
  LEAVE_ALREADY_PROCESSED: 'LEAVE_003',   // Đơn đã được duyệt hoặc từ chối trước đó
};

module.exports = ERROR_CODES;
