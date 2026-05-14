const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const { userRegisterSchema } = require("../validations/auth.validation");
const mailService = require("../services/mail.service");
const crypto = require("crypto");
const dns = require("dns").promises;

const prisma = require("../config/prisma");
const cache = require("../utils/memoryCache");
const { success, error: sendError } = require("../utils/response.helper");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

const buildAuthResponse = (message, token, user) => {
  return {
    success: true,
    message,
    token,
    user,
  };
};

exports.googleLogin = async (req, res) => {
  try {
    const { token, email: bodyEmail, name: bodyName } = req.body;

    let email;
    let name;

    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      email = payload.email;
      name = payload.name;
    } catch (idTokenError) {
      const axios = require("axios");

      try {
        const googleRes = await axios.get(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        email = googleRes.data.email;
        name = googleRes.data.name;
      } catch (accessTokenError) {
        if (bodyEmail && bodyName) {
          email = bodyEmail;
          name = bodyName;
        } else {
          throw new Error("Token Google tidak valid");
        }
      }
    }

    let user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          nama: name,
          role: "user",
          tipe_akun: "free",
          sisa_credit: 3,
          agreed_to_terms: true,
          agreed_at: new Date(),
        },
      });
    }

    const authToken = generateToken(user);
    return success(res, { 
      message: "Login Google berhasil", 
      data: { token: authToken, user } 
    });
  } catch (error) {
    return sendError(res, {
      message: "Login Google gagal",
      errors: [error.message]
    });
  }
};

exports.requestOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email wajib",
    });
  }

  // 1. Rate Limiting / Cooldown Check (1 minute)
  if (cache.get(`otp_cooldown_${email}`)) {
    return res.status(429).json({
      success: false,
      message: "Tunggu 1 menit sebelum meminta OTP lagi.",
    });
  }

  // 2. Quick domain validation
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      throw new Error();
    }
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: "Domain email tidak valid atau tidak dapat menerima email.",
    });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  try {
    // 3. Send OTP
    await mailService.sendOTP(email, otp);

    // 4. Set Cooldown
    cache.set(`otp_cooldown_${email}`, true, 60);

    // 5. Update DB or Cache
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.user.update({
        where: { email },
        data: { otp, otpExpires: expires },
      });
    } else {
      // Check if there is a pending registration
      const pendingReg = cache.get(`pending_reg_${email}`);
      if (pendingReg) {
        // Update the existing pending registration with new OTP
        cache.set(`pending_reg_${email}`, { ...pendingReg, otp, otpExpires: expires }, 5 * 60);
      } else {
        // Fallback for other cases
        cache.set(`pending_otp_${email}`, { otp, otpExpires: expires }, 5 * 60);
      }
    }

    return success(res, { message: "OTP sedang dikirim!" });
  } catch (error) {
    return sendError(res, { message: "Gagal memproses OTP", errors: [error.message] });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Check for Pending Registration in Cache
    let pendingData = cache.get(`pending_reg_${email}`) || cache.get(`pending_otp_${email}`);
    
    if (pendingData) {
      if (String(pendingData.otp) !== String(otp)) {
        return res.status(400).json({ success: false, message: "OTP salah" });
      }

      // Strict Expiry Check using getTime() to avoid timezone/object issues
      const now = Date.now();
      const expiry = new Date(pendingData.otpExpires).getTime();

      if (now > expiry) {
        cache.delete(`pending_reg_${email}`);
        cache.delete(`pending_otp_${email}`);
        return res.status(400).json({ success: false, message: "OTP kadaluarsa" });
      }

      // If it was a pending registration, move to DB
      let user;
      if (pendingData.nama && pendingData.password) {
        user = await prisma.user.upsert({
          where: { email: pendingData.email },
          update: {
            nama: pendingData.nama,
            password: pendingData.password,
            otp: null,
            otpExpires: null
          },
          create: {
            nama: pendingData.nama,
            email: pendingData.email,
            password: pendingData.password,
            role: "user",
            tipe_akun: "free",
            sisa_credit: 3,
            agreed_to_terms: true,
            agreed_at: new Date(),
          },
        });
      } else {
        // Just a simple OTP verification (like forgot password for non-existent user? unlikely but handled)
        user = await prisma.user.findUnique({ where: { email } });
      }

      // Cleanup cache
      cache.delete(`pending_reg_${email}`);
      cache.delete(`pending_otp_${email}`);

      if (user) {
        const authToken = generateToken(user);
        return success(res, { 
          message: "Verifikasi Berhasil", 
          data: { token: authToken, user } 
        });
      }
    }

    // 2. Fallback to Database (for Forgot Password or existing Unverified users)
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || String(user.otp) !== String(otp)) {
      return res.status(400).json({ success: false, message: "OTP salah" });
    }

    const now = Date.now();
    const expiry = new Date(user.otpExpires).getTime();

    if (now > expiry) {
      return res.status(400).json({ success: false, message: "OTP kadaluarsa" });
    }

    await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpires: null },
    });

    const authToken = generateToken(user);

    return success(res, { 
      message: "Verifikasi Berhasil", 
      data: { token: authToken, user } 
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.guestLogin = async (req, res) => {
  try {
    const { device_cookie } = req.body;

    let user = await prisma.user.findUnique({
      where: {
        device_cookie,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          nama: `guest_${Date.now()}`,
          device_cookie,
          role: "user",
          tipe_akun: "free",
          sisa_credit: 1,
        },
      });
    } else if (user.tipe_akun === "free" && user.sisa_credit <= 0) {
      return res.status(403).json({
        success: false,
        errorCode: "TRIAL_EXHAUSTED",
        message: "Your complimentary simulations have concluded.",
      });
    }

    const authToken = generateToken(user);
    return success(res, { 
      message: "Login guest berhasil", 
      data: { token: authToken, user } 
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bukan Admin",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Password salah",
      });
    }

    const authToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    return success(res, { 
      message: "Welcome Admin", 
      data: { token: authToken, user } 
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || user.role !== "user") {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah",
      });
    }

    if (user.otp !== null) {
      return res.status(403).json({
        success: false,
        message: "Akun belum diverifikasi. Silakan cek email Anda untuk kode OTP.",
        needsVerification: true,
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Silakan gunakan login Google atau metode lain yang terdaftar",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah",
      });
    }

    const authToken = generateToken(user);
    return success(res, { 
      message: "Login berhasil", 
      data: { token: authToken, user } 
    });
  } catch (error) {
    return sendError(res, { message: error.message });
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

    return success(res, { 
      statusCode: 201, 
      message: "Admin dibuat", 
      data: { user } 
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.userRegister = async (req, res) => {
  try {
    const validation = userRegisterSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((i) => i.message),
      });
    }

    const { nama, email, password } = validation.data;

    // Rate Limiting / Cooldown Check (1 minute)
    if (cache.get(`otp_cooldown_${email}`)) {
      return res.status(429).json({
        success: false,
        message: "Tunggu 1 menit sebelum meminta OTP lagi.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      // If user exists but is NOT verified (still has OTP), allow them to "re-register"
      // by deleting the old unverified account so the new one can be created.
      if (existingUser.otp !== null) {
        await prisma.user.delete({ where: { email } });
      } else {
        return res.status(400).json({
          success: false,
          message: "Email sudah terdaftar dan terverifikasi. Silakan login.",
        });
      }
    }

    // Quick domain validation to prevent obvious async bounces
    const domain = email.split("@")[1];
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        throw new Error();
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Domain email tidak valid atau tidak dapat menerima email. Periksa kembali penulisan domain Anda.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    // 1. Send OTP FIRST
    await mailService.sendOTP(email, otp);

    // 2. Set Cooldown for 1 minute
    cache.set(`otp_cooldown_${email}`, true, 60);

    // 3. STORE IN CACHE, NOT DATABASE
    // This keeps the User table clean until verified.
    cache.set(`pending_reg_${email}`, {
      nama,
      email,
      password: hashedPassword,
      otp,
      otpExpires,
    }, 5 * 60); // 5 minutes expiry

    return success(res, { 
      statusCode: 201, 
      message: "OTP telah dikirim ke email Anda. Silakan verifikasi untuk menyelesaikan pendaftaran." 
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user) {
      const otp = crypto.randomInt(100000, 999999).toString();

      await prisma.user.update({
        where: {
          email,
        },
        data: {
          otp,
          otpExpires: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      await mailService.sendOTP(email, otp);
    }

    return success(res, { message: "Instruksi reset password dikirim jika terdaftar." });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || String(user.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP salah atau tidak valid",
      });
    }

    if (new Date() > user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP kadaluarsa, silakan request ulang",
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal 6 karakter",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpires: null,
      },
    });

    return success(res, { message: "Password berhasil diubah. Silakan login dengan password baru." });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    return success(res, { message: "Berhasil logout" });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};