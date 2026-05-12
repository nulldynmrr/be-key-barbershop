const prisma = require("../config/prisma");
const axios = require("axios");

/**
 * POST /api/v1/waitlist
 * User kirim pesan ketika AI sedang tidak tersedia.
 * Simpan ke DB + kirim notifikasi ke Telegram admin.
 */
exports.submitWaitlist = async (req, res) => {
  try {
    const { pesan } = req.body;
    const userId = req.user?.id;

    if (!pesan) {
      return res.status(400).json({
        success: false,
        message: "Pesan wajib diisi.",
      });
    }

    // Ambil email user jika ada
    let userEmail = null;
    let userName = "Guest";
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userEmail = user.email || null;
        userName = user.nama || "Guest";
      }
    }

    // Simpan ke DB
    const entry = await prisma.waitlist.create({
      data: {
        email: userEmail,
        pesan: pesan.trim(),
      },
    });

    // Kirim notifikasi ke Telegram admin
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
      const htmlMessage = `
<b>✂️ PESAN BARU — Antrian Barber AI</b>

<b>User:</b> ${userName}
<b>Email:</b> ${userEmail ? `<code>${userEmail}</code>` : "<i>Tidak ada email (Guest)</i>"}
<b>Waktu:</b> ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}

<b>Pesan:</b>
<i>${pesan}</i>

<b>ID Antrian:</b> <code>${entry.id}</code>
      `;

      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
          text: htmlMessage,
          parse_mode: "HTML",
        }
      ).catch((tgErr) => {
        console.error("[Waitlist Telegram] Gagal kirim:", tgErr.message);
      });
    }

    res.status(201).json({
      success: true,
      message: "Pesan Anda berhasil terkirim. Barber kami akan segera menghubungi Anda.",
      data: { id: entry.id },
    });
  } catch (error) {
    console.error("Waitlist Error:", error.message);
    res.status(500).json({ success: false, message: "Gagal mengirim pesan. Silakan coba lagi." });
  }
};

/**
 * GET /api/v1/waitlist (Admin only)
 * Lihat daftar antrian yang masuk.
 */
exports.getWaitlist = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.waitlist.count(),
      prisma.waitlist.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.status(200).json({
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/v1/waitlist/:id/handle (Admin only)
 * Tandai antrian sudah ditangani.
 */
exports.markHandled = async (req, res) => {
  try {
    await prisma.waitlist.update({
      where: { id: req.params.id },
      data: { is_handled: true },
    });
    res.status(200).json({ success: true, message: "Antrian ditandai sudah ditangani." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
