const nodemailer = require('nodemailer');

//Cấu hình mailer, Cấu hình Nodemailer

const user = process.env.MAIL_USER || process.env.EMAIL_USER;
const pass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user,
        pass,
    },
});

const verifyMailer = async () => {
    try {
        await transporter.verify();
        console.log('Mail server connection: OK');
    } catch (error) {
        console.error(
            'Mail server connection failed:',
            error.message
        );
    }
};

module.exports = {
    transporter,
    verifyMailer,
};