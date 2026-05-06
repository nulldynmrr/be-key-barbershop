const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const { userRegisterSchema } = require("../validations/auth.validation");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");

const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Token Google wajib dikirim" });

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email,
          nama: name,
          role: "user",
          tipe_akun: "free",
          sisa_credit: 3,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Login Google berhasil",
      token: generateToken(user),
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login Google gagal",
      error: error.message,
    });
  }
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

exports.requestOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email wajib diisi" });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { otp, otpExpires: expires },
      create: {
        email,
        nama: "Pelanggan Key Barber",
        role: "user",
        tipe_akun: "free",
        sisa_credit: 3,
        otp,
        otpExpires: expires,
      },
    });

    await transporter.sendMail({
      from: '"Key Barber" <keybarber.mitra@gmail.com>',
      to: email,
      subject: "Kode Verifikasi Key Barber Kamu",
      html: `
        <div style="background-color: #f4f4f4; padding: 40px 0; font-family: sans-serif;">
          <div style="max-width: 400px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            
            <div style="background-color: #ffffff; padding: 40px 30px 10px 30px; text-align: center;">
              <img src="cid:logo_keybarber" width="120" alt="Key Barber" style="display: block; margin: 0 auto;">
            </div>

            <div style="padding: 10px 30px 40px 30px; text-align: center;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px; font-weight: 700;">Konfirmasi Verifikasi</h2>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">Masukkan kode keamanan berikut untuk mengakses akun Anda.</p>
              
              <div style="background-color: #fdfdfd; border: 1px solid #eeeeee; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #1a1a1a; font-family: monospace;">${otp}</span>
              </div>

              <div style="display: inline-block; background-color: #fff5f5; border: 1px solid #feb2b2; padding: 6px 15px; border-radius: 20px;">
                <span style="color: #c53030; font-size: 12px; font-weight: 600; text-transform: uppercase;">Berlaku 5 Menit</span>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 25px; line-height: 1.6;">
                Harap jangan membagikan kode ini kepada siapa pun.<br>
                Jika Anda tidak meminta kode ini, abaikan email ini.
              </p>
            </div>

            <div style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #f1f1f1;">
              <p style="color: #bbb; font-size: 10px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Key Barber Platform 2026</p>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: "logo key barber.png",
          path: path.join(__dirname, "../assets/logo key barber.png"),
          cid: "logo_keybarber",
        },
      ],
    });
    res.status(200).json({ success: true, message: "OTP terkirim ke email!" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengirim OTP",
      error: error.message,
    });
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || String(user.otp) !== String(otp)) {
      return res
        .status(400)
        .json({ success: false, message: "Kode OTP salah!" });
    }

    if (new Date() > user.otpExpires) {
      return res
        .status(400)
        .json({ success: false, message: "OTP sudah kadaluarsa!" });
    }

    await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpires: null },
    });

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Verifikasi Berhasil!",
      token,
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.guestLogin = async (req, res) => {
  try {
    const { device_cookie } = req.body;
    let user = await prisma.user.findUnique({ where: { device_cookie } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          nama: "Guest User",
          device_cookie,
          role: "user",
          tipe_akun: "free",
          sisa_credit: 1,
        },
      });
    }

    res
      .status(200)
      .json({ success: true, token: generateToken(user), data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email dan password wajib diisi!" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Akses ditolak. Anda bukan Admin!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Password salah!" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.status(200).json({
      success: true,
      message: "Selamat datang",
      token,
      user: { id: user.id, nama: user.nama, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, nama } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nama,
        role: "admin",
        sisa_credit: 999,
      },
    });

    res.status(201).json({
      success: true,
      message: "Admin berhasil dibuat!",
      data: { email: user.email, nama: user.nama },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.userRegister = async (req, res) => {
  try {
    const validation = userRegisterSchema.safeParse(req.body);

    if (!validation.success) {
      const errorMessages = validation.error.issues.map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validasi gagal",
        errors: errorMessages,
      });
    }

    const { nama, email, password } = validation.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email sudah terdaftar.",
        errors: ["Email sudah terdaftar. Silakan login."],
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        role: "user",
        tipe_akun: "free",
        sisa_credit: 3,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Akun berhasil dibuat",
      token: generateToken(newUser),
      data: { id: newUser.id, nama: newUser.nama, email: newUser.email },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server.",
      errors: [error.message],
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    res.status(200).json({
      success: true,
      message: "Jika email terdaftar, instruksi reset akan dikirim.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
