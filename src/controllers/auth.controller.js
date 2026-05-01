const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const { userRegisterSchema } = require("../validations/auth.validation");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

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
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.requestOTP = async (req, res) => {
  const { email } = req.body;

  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await prisma.user.update({
      where: { email },
      data: { otp, otpExpires: expires },
    });

    await transporter.sendMail({
      from: '"Key Barber Support" <no-reply@keybarber.com>',
      to: email,
      subject: "Kode OTP Verifikasi Kamu",
      html: `<b>${otp}</b> adalah kode verifikasi kamu. Berlaku selama 5 menit.`,
    });

    res.status(200).json({ success: true, message: "OTP terkirim ke email!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.otp !== otp) {
    return res.status(400).json({ success: false, message: "Kode OTP salah!" });
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

  res.status(200).json({ success: true, message: "Verifikasi Berhasil!" });
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
    console.error("userRegister error:", error.message);
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
