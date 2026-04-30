const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");

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

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Token Google wajib dikirim" });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const setting = await prisma.systemSetting.findFirst({
        where: { id: 1 },
      });
      const initialCredit = setting ? setting.default_new_user_credit : 3;

      user = await prisma.user.create({
        data: {
          email: email,
          nama: name,
          role: "user",
          tipe_akun: "free",
          sisa_credit: initialCredit,
        },
      });
    }

    const jwtToken = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Login Google berhasil",
      token: jwtToken,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login Google gagal atau token tidak valid",
      error: error.message,
    });
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

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Anda bukan Admin!",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Password salah!",
      });
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
      user: {
        id: user.id,
        nama: user.nama,
        role: user.role,
      },
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
