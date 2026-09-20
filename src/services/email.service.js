let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

/**
 * Khởi tạo transporter với Nodemailer
 */
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER || process.env.MAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.MAIL_PASSWORD;

  if (!user || !pass || !nodemailer) {
    return {
      sendMail: async (mailOptions) => {
        console.log(`[Mock Mailer] Giả lập gửi email đến ${mailOptions.to}: ${mailOptions.subject}`);
        return { messageId: 'simulated-' + Date.now() };
      },
    };
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

/**
 * Gửi email cảnh báo ghi nhận vắng mặt không phép (Cron Auto Absent #21)
 * @param {Object} params
 * @param {string} params.to Email người nhận
 * @param {string} params.fullName Họ tên giảng viên/nhân viên
 * @param {string} params.shiftName Tên ca học/ca làm việc
 * @param {string|Date} params.date Ngày vắng mặt
 */
const sendAbsentWarningEmail = async ({ to, fullName, shiftName, date }) => {
  const transporter = createTransporter();
  const dateStr = formatDate(date);

  const mailOptions = {
    from: `"Hệ thống Quản lý Chấm công Đại học" <${process.env.EMAIL_USER || process.env.MAIL_USER || 'no-reply@university.edu.vn'}>`,
    to,
    subject: `[CẢNH BÁO] Ghi nhận vắng mặt ca dạy ngày ${dateStr} - Hệ Thống Chấm Công`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; color: #333;">
        <div style="background-color: #d32f2f; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">CẢNH BÁO GHI NHẬN VẮNG MẶT</h2>
        </div>
        <div style="padding: 24px; line-height: 1.6;">
          <p>Kính gửi Thầy/Cô <strong>${fullName}</strong>,</p>
          <p>Hệ thống quản lý chấm công tự động ghi nhận Thầy/Cô đã <strong>VẮNG MẶT (Không phát sinh dữ liệu chấm công)</strong> trong ca làm việc/giảng dạy:</p>
          <div style="background-color: #fdf2f2; border-left: 4px solid #d32f2f; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 4px 0;"><strong>Ca làm việc / Tiết dạy:</strong> ${shiftName || 'Không xác định'}</p>
            <p style="margin: 4px 0;"><strong>Ngày ghi nhận:</strong> ${dateStr}</p>
            <p style="margin: 4px 0;"><strong>Trạng thái:</strong> <span style="color: #d32f2f; font-weight: bold;">VẮNG MẶT (ABSENT)</span></p>
          </div>
          <p><strong>Hướng dẫn xử lý giải trình:</strong></p>
          <ul style="padding-left: 20px; color: #555;">
            <li>Nếu có sự cố kỹ thuật về thiết bị chấm công hoặc lý do bất khả kháng, Thầy/Cô vui lòng đăng nhập vào cổng thông tin để <strong>Tạo đơn giải trình / Đơn xin dạy bù</strong> trong vòng 48 giờ.</li>
            <li>Đơn giải trình sẽ được Trưởng Khoa / Ban Giám Hiệu xem xét và cập nhật lại trạng thái công nếu được phê duyệt.</li>
          </ul>
          <p style="margin-top: 24px;">Trân trọng,<br><strong>Phòng Đào tạo & Quản trị Nhân sự</strong></p>
        </div>
        <div style="background-color: #f5f5f5; color: #777; padding: 12px; text-align: center; font-size: 12px; border-top: 1px solid #eee;">
          Email tự động được gửi từ Hệ thống Quản lý Chấm công Trường Đại học. Vui lòng không trả lời trực tiếp email này.
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

/**
 * Gửi email thông báo Check-in thành công (Đúng giờ hoặc Đi muộn)
 */
const sendCheckInNotificationEmail = async ({
  to,
  fullName,
  shiftName,
  shiftHours,
  checkInTime,
  status,
  lateMinutes = 0,
  method = 'face',
  subjectName,
  roomId,
}) => {
  if (!to) return;
  const transporter = createTransporter();
  const timeStr = new Date(checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = formatDate(checkInTime);
  const isLate = status === 'LATE' || lateMinutes > 0;
  const lateHours = Math.floor(lateMinutes / 60);
  const remainingMins = lateMinutes % 60;
  const lateTimeFormatted = lateHours > 0 ? `${lateHours} giờ ${remainingMins} phút` : `${lateMinutes} phút`;

  const methodTextMap = {
    face: 'Sinh trắc học Face ID (Kiosk Sảnh)',
    qr: 'Quét mã QR Code Động (Điện thoại)',
    manual: 'Cổng thông tin Web / Thủ công',
    gps: 'Định vị GPS di động',
  };
  const methodStr = methodTextMap[method] || method;

  const headerColor = isLate ? '#d97706' : '#16a34a';
  const statusTitle = isLate ? `ĐI MUỘN (${lateTimeFormatted})` : 'ĐÚNG GIỜ';
  const subject = isLate
    ? `[CẢNH BÁO ĐI MUỘN] Check-in ca dạy ngày ${dateStr} (Đi muộn ${lateTimeFormatted}) - Hệ Thống Chấm Công`
    : `[XÁC NHẬN CHẤM CÔNG] Check-in Vào Ca Thành Công (${dateStr}) - Hệ Thống Chấm Công`;

  const mailOptions = {
    from: `"Hệ thống Quản lý Chấm công Đại học" <${process.env.EMAIL_USER || process.env.MAIL_USER || 'no-reply@university.edu.vn'}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b; background-color: #ffffff;">
        <div style="background-color: ${headerColor}; color: #ffffff; padding: 22px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">XÁC NHẬN ĐIỂM DANH VÀO CA</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Hệ Thống Chấm Công Sinh Trắc Học & QR Code Đại Học</p>
        </div>
        <div style="padding: 24px; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Kính gửi Thầy/Cô <strong>${fullName}</strong>,</p>
          <p style="font-size: 14px; color: #475569;">
            Hệ thống đã ghi nhận lượt điểm danh <strong>Check-in (Vào ca)</strong> của Thầy/Cô với thông tin chi tiết như sau:
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid ${headerColor}; padding: 16px 20px; margin: 18px 0; border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Ca làm việc:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${shiftName || 'Không xác định'} ${shiftHours ? `(${shiftHours})` : ''}</td>
              </tr>
              ${subjectName ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Môn học / Tiết dạy:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${subjectName} ${roomId ? `(Phòng ${roomId})` : ''}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Thời gian Check-in:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${timeStr} &bull; ${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Trạng thái:</td>
                <td style="padding: 6px 0;">
                  <span style="display: inline-block; background-color: ${isLate ? '#fef3c7' : '#dcfce7'}; color: ${isLate ? '#b45309' : '#15803d'}; font-weight: bold; padding: 3px 10px; border-radius: 6px; font-size: 13px;">
                    ${statusTitle}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Phương thức:</td>
                <td style="padding: 6px 0; color: #334155;">${methodStr}</td>
              </tr>
            </table>
          </div>

          ${isLate ? `
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; font-size: 13px; color: #92400e;">
            <strong>Lưu ý:</strong> Thầy/Cô đã check-in muộn <strong>${lateTimeFormatted}</strong> so với giờ bắt đầu ca dạy quy định. Nếu có lý do khách quan, Thầy/Cô có thể gửi Đơn giải trình trên cổng thông tin trong vòng 48h.
          </div>
          ` : `
          <p style="font-size: 13px; color: #15803d; margin-bottom: 18px;">
            ✓ Thầy/Cô đã có mặt đúng giờ theo quy định giảng dạy của nhà trường. Chúc Thầy/Cô có buổi làm việc hiệu quả!
          </p>
          `}

          <p style="margin-top: 20px; font-size: 14px;">Trân trọng,<br><strong>Phòng Đào tạo & Quản trị Nhân sự</strong></p>
        </div>
        <div style="background-color: #f1f5f9; color: #64748b; padding: 12px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
          Email tự động được gửi từ Hệ thống Quản lý Chấm công Trường Đại học.
        </div>
      </div>
    `,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] [CHECK-IN EMAIL] Đã gửi thông báo check-in thành công tới ${to} (Subject: "${subject}")`);
  return result;
};

/**
 * Gửi email thông báo Check-out thành công (Hoàn thành ca hoặc Về sớm)
 */
const sendCheckOutNotificationEmail = async ({
  to,
  fullName,
  shiftName,
  checkInTime,
  checkOutTime,
  durationFormatted,
  status,
  isEarlyLeave = false,
  earlyMinutes = 0,
  method = 'face',
}) => {
  if (!to) return;
  const transporter = createTransporter();
  const checkInTimeStr = checkInTime ? new Date(checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
  const checkOutTimeStr = new Date(checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = formatDate(checkOutTime);

  const methodTextMap = {
    face: 'Sinh trắc học Face ID (Kiosk Sảnh)',
    qr: 'Quét mã QR Code Động (Điện thoại)',
    manual: 'Cổng thông tin Web / Thủ công',
    gps: 'Định vị GPS di động',
  };
  const methodStr = methodTextMap[method] || method;

  const earlyHours = Math.floor(earlyMinutes / 60);
  const remainingEarlyMins = earlyMinutes % 60;
  const earlyTimeFormatted = earlyHours > 0 ? `${earlyHours} giờ ${remainingEarlyMins} phút` : `${earlyMinutes} phút`;

  const headerColor = isEarlyLeave ? '#f59e0b' : '#0284c7';
  const statusTitle = isEarlyLeave ? `VỀ SỚM (${earlyTimeFormatted})` : 'HOÀN THÀNH CA DẠY';
  const subject = isEarlyLeave
    ? `[CẢNH BÁO VỀ SỚM] Check-out ca dạy ngày ${dateStr} (Về sớm ${earlyTimeFormatted}) - Hệ Thống Chấm Công`
    : `[XÁC NHẬN CHẤM CÔNG] Check-out Hoàn Thành Ca Dạy (${dateStr}) - Hệ Thống Chấm Công`;

  const mailOptions = {
    from: `"Hệ thống Quản lý Chấm công Đại học" <${process.env.EMAIL_USER || process.env.MAIL_USER || 'no-reply@university.edu.vn'}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b; background-color: #ffffff;">
        <div style="background-color: ${headerColor}; color: #ffffff; padding: 22px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">XÁC NHẬN ĐIỂM DANH RA VỀ</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Hệ Thống Chấm Công Sinh Trắc Học & QR Code Đại Học</p>
        </div>
        <div style="padding: 24px; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Kính gửi Thầy/Cô <strong>${fullName}</strong>,</p>
          <p style="font-size: 14px; color: #475569;">
            Hệ thống đã ghi nhận lượt điểm danh <strong>Check-out (Ra về)</strong> của Thầy/Cô với thông tin chi tiết:
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid ${headerColor}; padding: 16px 20px; margin: 18px 0; border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Ca làm việc:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${shiftName || 'Không xác định'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Thời gian Vào ca:</td>
                <td style="padding: 6px 0; color: #334155;">${checkInTimeStr}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Thời gian Ra về:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${checkOutTimeStr} &bull; ${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Tổng thời gian dạy:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0284c7;">${durationFormatted || 'Chưa ghi nhận'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Trạng thái:</td>
                <td style="padding: 6px 0;">
                  <span style="display: inline-block; background-color: ${isEarlyLeave ? '#fef3c7' : '#e0f2fe'}; color: ${isEarlyLeave ? '#b45309' : '#0369a1'}; font-weight: bold; padding: 3px 10px; border-radius: 6px; font-size: 13px;">
                    ${statusTitle}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Phương thức:</td>
                <td style="padding: 6px 0; color: #334155;">${methodStr}</td>
              </tr>
            </table>
          </div>

          ${isEarlyLeave ? `
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; font-size: 13px; color: #92400e;">
            <strong>Lưu ý:</strong> Hệ thống ghi nhận Thầy/Cô kết thúc ca dạy sớm <strong>${earlyTimeFormatted}</strong> trước giờ tan ca quy định.
          </div>
          ` : `
          <p style="font-size: 13px; color: #0284c7; margin-bottom: 18px;">
            ✓ Thầy/Cô đã hoàn thành trọn vẹn thời lượng tiết dạy theo kế hoạch đào tạo.
          </p>
          `}

          <p style="margin-top: 20px; font-size: 14px;">Trân trọng,<br><strong>Phòng Đào tạo & Quản trị Nhân sự</strong></p>
        </div>
        <div style="background-color: #f1f5f9; color: #64748b; padding: 12px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
          Email tự động được gửi từ Hệ thống Quản lý Chấm công Trường Đại học.
        </div>
      </div>
    `,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] [CHECK-OUT EMAIL] Đã gửi thông báo check-out thành công tới ${to} (Subject: "${subject}")`);
  return result;
};

/**
 * Gửi email báo cáo tổng kết chấm công toàn trường cuối ngày (23:59) cho Admin / Quản trị viên
 */
const sendDailyAttendanceSummaryEmail = async ({
  to,
  dateStr,
  totalSchedules = 0,
  stats = {
    onTimeCount: 0,
    lateCount: 0,
    earlyCount: 0,
    excusedCount: 0,
    absentCount: 0,
  },
  absentList = [],
  lateList = [],
  earlyList = [],
  excusedList = [],
  presentList = [],
}) => {
  if (!to) return;
  const transporter = createTransporter();

  const totalAttended = stats.onTimeCount + stats.lateCount + stats.earlyCount;
  const attendanceRate = totalSchedules > 0 
    ? Math.round(((totalAttended + stats.excusedCount) / totalSchedules) * 100) 
    : 100;

  const subject = `[BÁO CÁO CUỐI NGÀY] Tổng Hợp Điểm Danh & Chuyên Cần Ngày ${dateStr} - Hệ Thống Chấm Công`;

  const mailOptions = {
    from: `"Hệ thống Quản lý Chấm công Đại học" <${process.env.EMAIL_USER || process.env.MAIL_USER || 'no-reply@university.edu.vn'}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 24px; text-align: center;">
          <span style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">
            Báo Cáo Tự Động Cuối Ngày
          </span>
          <h2 style="margin: 6px 0; font-size: 22px; font-weight: bold;">TỔNG HỢP ĐIỂM DANH & CHUYÊN CẦN</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Ngày: <strong>${dateStr}</strong> &bull; Hệ thống Điểm danh Sinh trắc học & QR Code</p>
        </div>

        <div style="padding: 24px; line-height: 1.6;">
          <p style="margin-top: 0; font-size: 15px;">Kính gửi <strong>Ban Giám Hiệu & Quản Trị Viên Hệ Thống</strong>,</p>
          <p style="font-size: 14px; color: #475569;">
            Hệ thống đã hoàn tất tiến trình rà soát và đối chiếu dữ liệu chấm công toàn trường vào cuối ngày <strong>${dateStr}</strong>. Dưới đây là thống kê chi tiết:
          </p>

          <!-- Bảng số liệu thống kê nhanh -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Tổng Ca Dạy</div>
              <div style="font-size: 22px; font-weight: bold; color: #0f172a; margin-top: 4px;">${totalSchedules}</div>
            </div>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; color: #047857; font-weight: bold; text-transform: uppercase;">Đúng Giờ</div>
              <div style="font-size: 22px; font-weight: bold; color: #059669; margin-top: 4px;">${stats.onTimeCount}</div>
            </div>
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; color: #b45309; font-weight: bold; text-transform: uppercase;">Đi Muộn</div>
              <div style="font-size: 22px; font-weight: bold; color: #d97706; margin-top: 4px;">${stats.lateCount}</div>
            </div>
            <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; color: #c2410c; font-weight: bold; text-transform: uppercase;">Về Sớm</div>
              <div style="font-size: 22px; font-weight: bold; color: #ea580c; margin-top: 4px;">${stats.earlyCount}</div>
            </div>
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; color: #1d4ed8; font-weight: bold; text-transform: uppercase;">Nghỉ Có Phép</div>
              <div style="font-size: 22px; font-weight: bold; color: #2563eb; margin-top: 4px;">${stats.excusedCount}</div>
            </div>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; color: #b91c1c; font-weight: bold; text-transform: uppercase;">Vắng Không Phép</div>
              <div style="font-size: 22px; font-weight: bold; color: #dc2626; margin-top: 4px;">${stats.absentCount}</div>
            </div>
          </div>

          <!-- Tỷ lệ chuyên cần -->
          <div style="background-color: #f1f5f9; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span><strong>Tỷ lệ giảng dạy / có mặt hợp lệ:</strong></span>
              <strong style="color: #2563eb;">${attendanceRate}%</strong>
            </div>
            <div style="background-color: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden;">
              <div style="background-color: #2563eb; height: 100%; width: ${Math.min(100, attendanceRate)}%;"></div>
            </div>
          </div>

          <!-- 1. Danh sách Vắng mặt không phép (Cần chú ý đặc biệt) -->
          <h3 style="font-size: 15px; color: #b91c1c; border-bottom: 2px solid #fee2e2; padding-bottom: 6px; margin: 20px 0 10px 0;">
            1. Danh Sách Vắng Mặt Không Phép (${absentList.length})
          </h3>
          ${absentList.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
            <thead>
              <tr style="background-color: #fef2f2; color: #991b1b; text-align: left;">
                <th style="padding: 8px; border: 1px solid #fecaca;">Nhân sự / Giảng viên</th>
                <th style="padding: 8px; border: 1px solid #fecaca;">Ca dạy / Lịch</th>
                <th style="padding: 8px; border: 1px solid #fecaca;">Khoa / Phòng</th>
                <th style="padding: 8px; border: 1px solid #fecaca; text-align: center;">Cảnh Báo</th>
              </tr>
            </thead>
            <tbody>
              ${absentList.map((item) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #fecaca; font-weight: bold; color: #1e293b;">${item.fullName}</td>
                <td style="padding: 8px; border: 1px solid #fecaca;">${item.shiftName} ${item.roomId ? `(${item.roomId})` : ''}</td>
                <td style="padding: 8px; border: 1px solid #fecaca; color: #64748b;">${item.departmentName || 'Khoa / Đơn vị'}</td>
                <td style="padding: 8px; border: 1px solid #fecaca; text-align: center; color: #dc2626; font-weight: bold;">
                  ${item.emailSent ? '✓ Đã gửi mail' : 'Chưa gửi'}
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : `
          <p style="font-size: 13px; color: #059669; background-color: #ecfdf5; padding: 10px; border-radius: 6px; margin-bottom: 18px;">
            ✓ Xuất sắc: Ngày hôm nay không có giảng viên/nhân sự nào vắng mặt không phép!
          </p>
          `}

          <!-- 2. Danh sách Đi muộn hoặc Về sớm -->
          <h3 style="font-size: 15px; color: #d97706; border-bottom: 2px solid #fef3c7; padding-bottom: 6px; margin: 20px 0 10px 0;">
            2. Danh Sách Đi Muộn & Về Sớm (${lateList.length + earlyList.length})
          </h3>
          ${(lateList.length + earlyList.length) > 0 ? `
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
            <thead>
              <tr style="background-color: #fffbeb; color: #92400e; text-align: left;">
                <th style="padding: 8px; border: 1px solid #fde68a;">Nhân sự</th>
                <th style="padding: 8px; border: 1px solid #fde68a;">Ca làm việc</th>
                <th style="padding: 8px; border: 1px solid #fde68a;">Chi tiết vi phạm</th>
                <th style="padding: 8px; border: 1px solid #fde68a; text-align: center;">Phương thức</th>
              </tr>
            </thead>
            <tbody>
              ${lateList.map((item) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #fde68a; font-weight: bold;">${item.fullName}</td>
                <td style="padding: 8px; border: 1px solid #fde68a;">${item.shiftName}</td>
                <td style="padding: 8px; border: 1px solid #fde68a; color: #d97706; font-weight: bold;">
                  Đi muộn ${item.lateTimeFormatted || (item.lateMinutes + ' phút')} (Vào lúc ${item.checkInTimeStr})
                </td>
                <td style="padding: 8px; border: 1px solid #fde68a; text-align: center;">${item.method}</td>
              </tr>
              `).join('')}
              ${earlyList.map((item) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #fde68a; font-weight: bold;">${item.fullName}</td>
                <td style="padding: 8px; border: 1px solid #fde68a;">${item.shiftName}</td>
                <td style="padding: 8px; border: 1px solid #fde68a; color: #ea580c; font-weight: bold;">
                  Về sớm ${item.earlyTimeFormatted || (item.earlyMinutes + ' phút')} (Tan lúc ${item.checkOutTimeStr})
                </td>
                <td style="padding: 8px; border: 1px solid #fde68a; text-align: center;">${item.method}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : `
          <p style="font-size: 13px; color: #059669; background-color: #ecfdf5; padding: 10px; border-radius: 6px; margin-bottom: 18px;">
            ✓ Toàn bộ giảng viên/nhân sự có mặt đều check-in và check-out đúng giờ quy định!
          </p>
          `}

          <!-- 3. Danh sách Đã Đến Làm Việc Đúng Giờ -->
          <h3 style="font-size: 15px; color: #059669; border-bottom: 2px solid #a7f3d0; padding-bottom: 6px; margin: 20px 0 10px 0;">
            3. Danh Sách Đã Đến Làm Việc Đúng Giờ (${presentList.length})
          </h3>
          ${presentList.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
            <thead>
              <tr style="background-color: #ecfdf5; color: #065f46; text-align: left;">
                <th style="padding: 8px; border: 1px solid #a7f3d0;">Nhân sự / Giảng viên</th>
                <th style="padding: 8px; border: 1px solid #a7f3d0;">Ca làm việc</th>
                <th style="padding: 8px; border: 1px solid #a7f3d0; text-align: center;">Giờ Check-in</th>
                <th style="padding: 8px; border: 1px solid #a7f3d0; text-align: center;">Phương thức</th>
                <th style="padding: 8px; border: 1px solid #a7f3d0; text-align: center;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${presentList.map((item) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #a7f3d0; font-weight: bold; color: #1e293b;">${item.fullName}</td>
                <td style="padding: 8px; border: 1px solid #a7f3d0;">${item.shiftName} ${item.roomId ? `(${item.roomId})` : ''}</td>
                <td style="padding: 8px; border: 1px solid #a7f3d0; text-align: center; color: #047857; font-weight: bold;">${item.checkInTimeStr}</td>
                <td style="padding: 8px; border: 1px solid #a7f3d0; text-align: center;">${item.method}</td>
                <td style="padding: 8px; border: 1px solid #a7f3d0; text-align: center;">
                  <span style="display: inline-block; background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Đúng giờ</span>
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : `
          <p style="font-size: 13px; color: #64748b; background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 6px; margin-bottom: 18px;">
            Hôm nay các lượt đến làm đều check-in sau giờ quy định (đã được thống kê chi tiết ở mục 2 Đi Muộn bên trên).
          </p>
          `}

          <!-- 4. Danh sách Nghỉ có phép -->
          ${excusedList.length > 0 ? `
          <h3 style="font-size: 15px; color: #2563eb; border-bottom: 2px solid #dbeafe; padding-bottom: 6px; margin: 20px 0 10px 0;">
            4. Danh Sách Nghỉ Có Phép Hợp Lệ (${excusedList.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
            <thead>
              <tr style="background-color: #eff6ff; color: #1e40af; text-align: left;">
                <th style="padding: 8px; border: 1px solid #bfdbfe;">Nhân sự</th>
                <th style="padding: 8px; border: 1px solid #bfdbfe;">Ca vắng</th>
                <th style="padding: 8px; border: 1px solid #bfdbfe;">Trạng thái đơn</th>
              </tr>
            </thead>
            <tbody>
              ${excusedList.map((item) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #bfdbfe; font-weight: bold;">${item.fullName}</td>
                <td style="padding: 8px; border: 1px solid #bfdbfe;">${item.shiftName}</td>
                <td style="padding: 8px; border: 1px solid #bfdbfe; color: #2563eb;">Đơn nghỉ phép đã được Ban Giám Hiệu duyệt</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            Thầy/Cô có thể đăng nhập cổng quản trị để xem biểu đồ phân tích trực quan hoặc trích xuất báo cáo Excel tại phân hệ <strong>Báo Cáo & Thống Kê</strong>.
          </p>

          <p style="margin-top: 20px; font-size: 14px;">Trân trọng,<br><strong>Phòng Đào tạo & Quản trị Nhân sự</strong></p>
        </div>

        <div style="background-color: #f1f5f9; color: #64748b; padding: 14px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
          Báo cáo tự động tổng hợp lúc 23:59 hàng ngày từ Hệ thống Quản trị Chấm công Trường Đại học.
        </div>
      </div>
    `,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] [DAILY SUMMARY EMAIL] Đã gửi báo cáo tổng kết cuối ngày tới ${to} (Subject: "${subject}")`);
  return result;
};

module.exports = {
  sendOtpEmail,
  sendRegistrationSuccessEmail,
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  sendAbsentWarningEmail,
  sendCheckInNotificationEmail,
  sendCheckOutNotificationEmail,
  sendDailyAttendanceSummaryEmail,
  formatDate,
};

