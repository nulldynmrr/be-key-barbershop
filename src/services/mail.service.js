const nodemailer = require("nodemailer");
const alertService = require("./alert.service");
const path = require("path");

const primaryTransporter = nodemailer.createTransport({
  host: process.env.SMTP_BACKUP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_BACKUP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_BACKUP_USER,
    pass: process.env.SMTP_BACKUP_PASS,
  },
});

const fallbackTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendOTP = async (email, otp) => {
  const currentYear = new Date().getFullYear();
  const mailOptions = {
    to: email,
    subject: "[Key Barber] Kode Verifikasi Akun Anda",
    text: `Gunakan kode keamanan berikut untuk mengakses akun Key Barber Anda:\n\n${otp}\n\nBerlaku selama 5 menit.`,
    replyTo: "no-reply@keybarber.id",
    html: `
      <div style="background-color: #ffffff; padding: 40px 0; font-family: sans-serif;">
        <div style="max-width: 400px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          <div style="background-color: #ffffff; padding: 40px 30px 10px 30px; text-align: center;">
            <img src="cid:logo_keybarber" width="120" alt="Key Barber" style="display: block; margin: 0 auto;">
          </div>
          <div style="padding: 10px 30px 40px 30px; text-align: center;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px; font-weight: 700;">Konfirmasi Verifikasi</h2>
            <p style="color: #777; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">Gunakan kode keamanan berikut untuk mengakses akun Anda.</p>
            <div style="background-color: #fdfdfd; border: 1px solid #eeeeee; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #1a1a1a; font-family: monospace;">${otp}</span>
            </div>
            <div style="display: inline-block; background-color: #fff5f5; border: 1px solid #feb2b2; padding: 6px 15px; border-radius: 20px;">
              <span style="color: #c53030; font-size: 12px; font-weight: 600; text-transform: uppercase;">Berlaku 5 Menit</span>
            </div>
          </div>
          <div style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #f1f1f1;">
            <p style="color: #bbb; font-size: 10px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Key Barber Platform ${currentYear}</p>
          </div>
        </div>
      </div>`,
    attachments: [
      {
        filename: "logo key barber.png",
        path: path.join(__dirname, "../assets/logo key barber.png"),
        cid: "logo_keybarber",
      },
    ],
  };

  try {
    await primaryTransporter.sendMail({
      ...mailOptions,
      from: `"Key Barber" <${process.env.SMTP_BACKUP_USER}>`,
    });
    console.log(`[MAIL] Berhasil ke ${email} via Gmail`);
  } catch (error) {
    try {
      await fallbackTransporter.sendMail({
        ...mailOptions,
        from: `"Key Barber" <${process.env.SMTP_USER}>`,
      });
      console.log(`[MAIL] Berhasil ke ${email} via Brevo`);
    } catch (fallbackError) {
      const detail = `Total Failure: ${error.message} | ${fallbackError.message}`;
      alertService.reportSystemError("Email-Service", detail, "CRITICAL");
    }
  }
};
