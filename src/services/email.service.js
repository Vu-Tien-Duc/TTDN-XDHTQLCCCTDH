const { transporter } = require('../config/mailer');

//Gửi email khi duyệt/từ chối

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
    sendLeaveApprovedEmail,
    sendLeaveRejectedEmail,
};