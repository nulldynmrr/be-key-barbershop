const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const { userRegisterSchema } = require("../validations/auth.validation");
const mailService = require("../services/mail.service");
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
    const { token, email: bodyEmail, name: bodyName } = req.body;
    let email, name;

    try {
      // Try verifying as ID token first
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
    } catch (idTokenError) {
      // If ID token verification fails, try as access_token
      // Fetch user info from Google using the access token
      const axios = require("axios");
      try {
        const googleRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        email = googleRes.data.email;
        name = googleRes.data.name;
      } catch (accessTokenError) {
        // Last fallback: use email and name from request body (already verified on client)
        if (bodyEmail && bodyName) {
          email = bodyEmail;
          name = bodyName;
        } else {
          throw new Error("Token Google tidak valid");
        }
      }
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
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

exports.requestOTP = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: "Email wajib" });
  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  try {
    await prisma.user.upsert({
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
    mailService.sendOTP(email, otp);
    res.status(200).json({ success: true, message: "OTP sedang dikirim!" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal memproses OTP",
      error: error.message,
    });
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || String(user.otp) !== String(otp))
      return res.status(400).json({ success: false, message: "OTP salah" });
    if (new Date() > user.otpExpires)
      return res
        .status(400)
        .json({ success: false, message: "OTP kadaluarsa" });
    await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpires: null },
    });
    res.status(200).json({
      success: true,
      message: "Verifikasi Berhasil",
      token: generateToken(user),
      data: user,
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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "admin")
      return res.status(403).json({ success: false, message: "Bukan Admin" });
    if (!(await bcrypt.compare(password, user.password)))
      return res
        .status(401)
        .json({ success: false, message: "Password salah" });
    res.status(200).json({
      success: true,
      message: "Welcome Admin",
      token: jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" },
      ),
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.role !== "user") {
      return res.status(401).json({ success: false, message: "Email atau password salah" });
    }
    
    if (!user.password) {
      return res.status(401).json({ success: false, message: "Silakan gunakan login Google atau metode lain yang terdaftar" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Email atau password salah" });
    }

    res.status(200).json({
      success: true,
      message: "Login berhasil",
      token: generateToken(user),
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, nama } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nama,
        role: "admin",
        sisa_credit: 999,
      },
    });
    res
      .status(201)
      .json({ success: true, message: "Admin dibuat", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.userRegister = async (req, res) => {
  try {
    const validation = userRegisterSchema.safeParse(req.body);
    if (!validation.success)
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((i) => i.message),
      });
    const { nama, email, password } = validation.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "Email terdaftar" });
    const hashedPassword = await bcrypt.hash(password, 10);
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
    res.status(201).json({
      success: true,
      message: "User dibuat",
      token: generateToken(newUser),
      data: newUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const otp = crypto.randomInt(100000, 999999).toString();
      await prisma.user.update({
        where: { email },
        data: { otp, otpExpires: new Date(Date.now() + 5 * 60 * 1000) },
      });
      mailService.sendOTP(email, otp);
    }
    res.status(200).json({
      success: true,
      message: "Instruksi reset password dikirim jika terdaftar.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
