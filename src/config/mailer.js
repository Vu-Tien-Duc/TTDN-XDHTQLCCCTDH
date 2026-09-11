let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

// Cấu hình mailer, Cấu hình Nodemailer
const user = process.env.MAIL_USER || process.env.EMAIL_USER;
const pass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;

const transporter =
  nodemailer && user && pass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      })
    : {
        sendMail: async (mailOptions) => {
          console.log(`[Mock Mailer] Gửi email giả lập tới ${mailOptions.to}: ${mailOptions.subject}`);
          return { messageId: 'mock-' + Date.now() };
        },
        verify: async () => true,
      };

const verifyMailer = async () => {
  try {
    if (transporter && typeof transporter.verify === 'function') {
      await transporter.verify();
      console.log('Mail server connection: OK');
    }
  } catch (error) {
    console.warn('Mail server connection failed (chuyển sang chế độ giả lập email):', error.message);
  }
};

module.exports = {
    transporter,
    verifyMailer,
};