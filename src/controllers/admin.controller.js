const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: "user",
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { ai_generations: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      total_data: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  const { search } = req.query;
  try {
    const users = await prisma.user.findMany({
      where: {
        role: "user",
        ...(search && {
          OR: [{ nama: { contains: search } }, { email: { contains: search } }],
        }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        tipe_akun: true,
        sisa_credit: true,
        status_langganan: true,
        tgl_berakhir_langganan: true,
        is_banned: true,
        createdAt: true,
        _count: {
          select: { ai_generations: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Berhasil mengambil daftar user",
      data: users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserDetail = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        ai_generations: true,
        system_api_logs: true,
        feedbacks: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }

    const { password, device_cookie, ...safeUser } = user;

    res.status(200).json({
      success: true,
      message: "Berhasil mengambil detail user",
      data: safeUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.adjustCredit = async (req, res) => {
  const { amount } = req.body;
  try {
    const delta = Number(amount);
    if (!Number.isFinite(delta)) {
      return res
        .status(400)
        .json({ success: false, message: "amount harus berupa angka" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { sisa_credit: { increment: delta } },
    });
    res.status(200).json({
      success: true,
      message: "Credit berhasil diupdate",
      new_credit: user.sisa_credit,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { is_banned } = req.body;
  try {
    if (typeof is_banned !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "is_banned harus boolean" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { is_banned },
    });
    res.status(200).json({
      success: true,
      message: is_banned ? "User berhasil diban" : "User berhasil di-unban",
      data: { id: user.id, is_banned: user.is_banned },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });
    res.status(200).json({ success: true, message: "User berhasil dihapus" });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findFirst({ where: { id: 1 } });
    res.status(200).json({
      success: true,
      message: "Berhasil mengambil pengaturan sistem",
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSetting.upsert({
      where: { id: 1 },
      update: req.body,
      create: { id: 1, ...req.body },
    });
    res.status(200).json({
      success: true,
      message: "Pengaturan sistem berhasil diupdate",
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    const data = await prisma.feedback.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
      success: true,
      message: "Berhasil mengambil daftar feedback",
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.resolveFeedback = async (req, res) => {
  try {
    await prisma.feedback.update({
      where: { id: parseInt(req.params.id) },
      data: { status: "resolved" },
    });
    res
      .status(200)
      .json({ success: true, message: "Feedback berhasil ditandai selesai" });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Feedback tidak ditemukan" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
