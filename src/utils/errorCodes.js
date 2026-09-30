/**
 * BẢNG MÃ LỖI CHUẨN TOÀN HỆ THỐNG (ERROR CODES)
 * Đề tài: Xây dựng ứng dụng quản lý chấm công trường đại học
 * Thống nhất chung giữa 3 thành viên theo kế hoạch Tuần 1.
 */

const ERROR_CODES = {
  // --- Ca làm việc (Shift Config) ---
  SHIFT_NOT_FOUND: 'SHIFT_001',           // Không tìm thấy ca làm việc
  SHIFT_IN_USE: 'SHIFT_002',              // Ca đang được sử dụng trong lịch, không thể xóa
  SHIFT_INVALID_DATA: 'SHIFT_003',        // Dữ liệu ca làm việc không hợp lệ (giờ sai, ngưỡng trễ âm)
  SHIFT_DUPLICATE: 'SHIFT_004',           // Ca làm việc đã tồn tại (trùng tên hoặc khung giờ)

  // --- Lịch phân công giảng dạy / công tác (Schedule) ---
  SCHEDULE_NOT_FOUND: 'SCHEDULE_001',     // Không tìm thấy lịch giảng dạy/công tác
  SCHEDULE_CONFLICT: 'SCHEDULE_002',      // Trùng lịch với ca khác cùng ngày/thứ trong học kỳ
  SCHEDULE_INVALID_DATA: 'SCHEDULE_003',  // Dữ liệu phân lịch không hợp lệ (thiếu trường, ngày kết thúc < bắt đầu)

  // --- Chấm công (Attendance) ---
  ATTENDANCE_ALREADY_EXISTS: 'ATTENDANCE_002', // Đã check-in ca này rồi, không check-in trùng
  ATTENDANCE_NO_OPEN_RECORD: 'ATTENDANCE_003', // Không tìm thấy ca check-in mở để check-out
  ATTENDANCE_NO_MATCHING_SCHEDULE: 'ATTENDANCE_004', // Không có lịch phù hợp hiện tại để check-in

  // --- Xác thực & Người dùng ---
  AUTH_TOKEN_INVALID: 'AUTH_002',         // Token không hợp lệ hoặc hết hạn
  AUTH_FORBIDDEN: 'AUTH_004',             // Không có quyền truy cập
  USER_NOT_FOUND: 'USER_001',             // Không tìm thấy người dùng
  USER_FACE_ALREADY_REGISTERED: 'USER_003', // Khuôn mặt này đã được đăng ký cho một tài khoản khác
};

module.exports = ERROR_CODES;
