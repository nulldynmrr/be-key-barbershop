const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Ambil profil diri sendiri
exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        tipe_akun: true,
        sisa_credit: true,
        status_langganan: true,
        tgl_berakhir_langganan: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update profil diri sendiri (misal ganti nama)
exports.updateProfile = async (req, res) => {
  const { nama } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { nama },
      select: { id: true, nama: true, email: true },
    });

    res
      .status(200)
      .json({ success: true, message: "Profil berhasil diupdate", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Ambil riwayat AI Generation milik sendiri
exports.getAiHistory = async (req, res) => {
  try {
    const history = await prisma.aIGeneration.findMany({
      where: { user_id: req.user.id },
      orderBy: { tgl_generate: "desc" },
    });

    res
      .status(200)
      .json({ success: true, total_data: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Ambil riwayat Transaksi milik sendiri
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { user_id: req.user.id },
      orderBy: { tgl_transaksi: "desc" },
    });

    res.status(200).json({
      success: true,
      total_data: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Kirim Feedback ke Admin
exports.submitFeedback = async (req, res) => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res
      .status(400)
      .json({ success: false, message: "Subject dan message wajib diisi" });
  }

  try {
    const feedback = await prisma.feedback.create({
      data: {
        user_id: req.user.id,
        subject,
        message,
      },
    });

    res.status(201).json({
      success: true,
      message: "Feedback berhasil dikirim",
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lihat daftar Feedback yang pernah dikirim diri sendiri
exports.getMyFeedbacks = async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { user_id: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
