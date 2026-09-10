const nodemailer = require('nodemailer');

//Cấu hình mailer, Cấu hình Nodemailer

const transporter = nodemailer.createTransport({
    service: 'gmail',

    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
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