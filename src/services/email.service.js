const nodemailer = require('nodemailer');

/**
 * Khởi tạo transporter với Nodemailer
 */
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.MAIL_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Gửi email chứa mã OTP xác thực
 * @param {string} toEmail Email người nhận
 * @param {string} fullName Họ tên người nhận
 * @param {string} otp Mã OTP 6 chữ số
 * @param {'VERIFY_ACCOUNT'|'FORGOT_PASSWORD'} type Loại xác thực
 */
const sendOtpEmail = async (toEmail, fullName, otp, type = 'VERIFY_ACCOUNT') => {
  const isVerify = type === 'VERIFY_ACCOUNT';
  const subject = isVerify
    ? '[Hệ Thống Chấm Công] Mã OTP xác minh đăng ký tài khoản'
    : '[Hệ Thống Chấm Công] Mã OTP yêu cầu đặt lại mật khẩu';

  const actionText = isVerify ? 'xác minh và kích hoạt tài khoản' : 'đặt lại mật khẩu tài khoản';
  const warningText = isVerify
    ? 'Lưu ý: Mã OTP này có thời hạn sống đúng <strong>10 phút</strong>. Nếu quá 10 phút bạn không xác minh, tài khoản tạm thời sẽ tự động bị xóa khỏi hệ thống để bảo mật dữ liệu.'
    : 'Lưu ý: Mã OTP này có hiệu lực trong <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; color: #333;">
      <div style="background-color: #1976d2; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px;">HỆ THỐNG QUẢN LÝ CHẤM CÔNG ĐẠI HỌC</h2>
      </div>
      <div style="padding: 24px; line-height: 1.6;">
        <p>Kính chào <strong>${fullName || 'Quý Thầy/Cô và Cán bộ'}</strong>,</p>
        <p>Hệ thống nhận được yêu cầu ${actionText} cho địa chỉ email: <strong>${toEmail}</strong>.</p>
        
        <div style="margin: 25px 0; text-align: center;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1976d2; background-color: #f0f4f8; padding: 12px 28px; border-radius: 6px; border: 1px dashed #1976d2;">
            ${otp}
          </span>
        </div>

        <p style="color: #d32f2f; font-size: 14px; background: #ffebee; padding: 12px; border-radius: 4px; border-left: 4px solid #d32f2f;">
          ${warningText}
        </p>

        <p style="font-size: 13px; color: #666; margin-top: 25px;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ với Quản trị viên nhà trường.
        </p>
      </div>
      <div style="background-color: #f5f5f5; padding: 12px; text-align: center; font-size: 12px; color: #777;">
        © 2026 Hệ Thống Quản Lý Chấm Công Trường Đại Học. All rights reserved.
      </div>
    </div>
  `;

  // Luôn ghi log OTP ra Terminal để phục vụ kiểm thử / demo cục bộ
  console.log(`\n=============================================================`);
  console.log(`[EMAIL SERVICE] OTP [${otp}] -> [${toEmail}] (${type})`);
  console.log(`[EMAIL SERVICE] Thời hạn sống: 10 phút`);
  console.log(`=============================================================\n`);

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[EMAIL SERVICE - DEV MODE] Chưa cấu hình EMAIL_USER / EMAIL_PASS trong .env. Sử dụng mã OTP trên Terminal để test.`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"Hệ Thống Chấm Công" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent,
    });
    console.log(`✔ [EMAIL SERVICE] Đã gửi email OTP thành công tới: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`✖ [EMAIL SERVICE] Không thể gửi mail tới ${toEmail}:`, error.message);
    return false;
  }
};

/**
 * Gửi email thông báo kích hoạt tài khoản thành công
 * @param {string} toEmail Email người nhận
 * @param {string} fullName Họ tên người nhận
 */
const sendRegistrationSuccessEmail = async (toEmail, fullName) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; color: #333;">
      <div style="background-color: #2e7d32; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px;">KÍCH HOẠT TÀI KHOẢN THÀNH CÔNG</h2>
      </div>
      <div style="padding: 24px; line-height: 1.6;">
        <p>Xin chúc mừng <strong>${fullName || 'Quý Thầy/Cô và Cán bộ'}</strong>,</p>
        <p>Tài khoản của bạn với email <strong>${toEmail}</strong> đã được xác minh danh tính thành công qua mã OTP.</p>
        <p>Hiện tại bạn đã có thể đăng nhập vào hệ thống để bắt đầu xem lịch giảng dạy, công tác và thực hiện chấm công.</p>
        
        <div style="margin: 25px 0; text-align: center;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}" style="display: inline-block; background-color: #2e7d32; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Đăng Nhập Ngay
          </a>
        </div>

        <p style="font-size: 13px; color: #666;">
          Trân trọng,<br/>
          <strong>Ban Quản Trị Hệ Thống Chấm Công Trường Đại Học</strong>
        </p>
      </div>
    </div>
  `;

  console.log(`✔ [EMAIL SERVICE] Gửi email thông báo kích hoạt thành công tới: ${toEmail}`);

  const transporter = createTransporter();
  if (!transporter) return true;

  try {
    await transporter.sendMail({
      from: `"Hệ Thống Chấm Công" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: '[Hệ Thống Chấm Công] Tài khoản của bạn đã được kích hoạt thành công!',
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error(`✖ [EMAIL SERVICE] Lỗi gửi email kích hoạt thành công tới ${toEmail}:`, error.message);
    return false;
  }
};

const { transporter } = require('../config/mailer');

// Gửi email khi duyệt/từ chối

/**
 * Gửi email thông báo đơn nghỉ được duyệt
 */
const sendLeaveApprovedEmail = async ({
    to,
    fullName,
    fromDate,
    toDate,
    approvalNote = '',
}) => {
    if (!to) {
        throw new Error(
            'Không có email người nhận'
        );
    }

    const mailOptions = {
        from: `"Hệ thống quản lý chấm công" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Đơn xin nghỉ của bạn đã được duyệt',

        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Thông báo duyệt đơn xin nghỉ</h2>

        <p>Xin chào <strong>${fullName}</strong>,</p>

        <p>
          Đơn xin nghỉ của bạn đã được
          <strong>DUYỆT</strong>.
        </p>

        <table style="border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 12px 6px 0;">
              Từ ngày:
            </td>
            <td>
              <strong>${formatDate(fromDate)}</strong>
            </td>
          </tr>

          <tr>
            <td style="padding: 6px 12px 6px 0;">
              Đến ngày:
            </td>
            <td>
              <strong>${formatDate(toDate)}</strong>
            </td>
          </tr>
        </table>

        ${approvalNote
                ? `
              <p>
                <strong>Ghi chú:</strong>
                ${approvalNote}
              </p>
            `
                : ''
            }

        <p>
          Vui lòng kiểm tra hệ thống để xem
          thông tin chi tiết.
        </p>

        <p>
          Trân trọng,<br>
          <strong>Hệ thống quản lý chấm công</strong>
        </p>
      </div>
    `,
    };

    return await transporter.sendMail(mailOptions);
};

/**
 * Gửi email thông báo đơn nghỉ bị từ chối
 */
const sendLeaveRejectedEmail = async ({
    to,
    fullName,
    fromDate,
    toDate,
    rejectionReason,
}) => {
    if (!to) {
        throw new Error(
            'Không có email người nhận'
        );
    }

    const mailOptions = {
        from: `"Hệ thống quản lý chấm công" <${process.env.MAIL_USER}>`,
        to,

        subject: 'Đơn xin nghỉ của bạn đã bị từ chối',

        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Thông báo từ chối đơn xin nghỉ</h2>

        <p>Xin chào <strong>${fullName}</strong>,</p>

        <p>
          Đơn xin nghỉ của bạn đã bị
          <strong>TỪ CHỐI</strong>.
        </p>

        <table style="border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 12px 6px 0;">
              Từ ngày:
            </td>
            <td>
              <strong>${formatDate(fromDate)}</strong>
            </td>
          </tr>

          <tr>
            <td style="padding: 6px 12px 6px 0;">
              Đến ngày:
            </td>
            <td>
              <strong>${formatDate(toDate)}</strong>
            </td>
          </tr>
        </table>

        <p>
          <strong>Lý do từ chối:</strong>
          ${rejectionReason}
        </p>

        <p>
          Vui lòng đăng nhập hệ thống để xem
          thông tin chi tiết.
        </p>

        <p>
          Trân trọng,<br>
          <strong>Hệ thống quản lý chấm công</strong>
        </p>
      </div>
    `,
    };

    return await transporter.sendMail(mailOptions);
};

/**
 * Format ngày theo DD/MM/YYYY
 */
const formatDate = (date) => {
    if (!date) return '';

    const d = new Date(date);

    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

module.exports = {
  sendOtpEmail,
  sendRegistrationSuccessEmail,
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  formatDate,
};
