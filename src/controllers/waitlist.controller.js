const prisma = require("../config/prisma");
const axios = require("axios");
const { success, error: sendError } = require("../utils/response.helper");

/**
 * POST /api/v1/waitlist
 * User kirim pesan ketika AI sedang tidak tersedia.
 * Simpan ke DB + kirim notifikasi ke Telegram admin.
 */
exports.submitWaitlist = async (req, res) => {
  try {
    const { pesan, phone } = req.body;
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
        userId: userId || null,
        email: userEmail,
        phone: phone || null,
        pesan: pesan.trim(),
      },
    });

    // Kirim notifikasi ke Telegram admin
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
      const htmlMessage = `
<b>✂️ PESAN BARU — Antrian Barber AI</b>

<b>User:</b> ${userName}
<b>Email:</b> ${userEmail ? `<code>${userEmail}</code>` : "<i>Tidak ada email (Guest)</i>"}
<b>Phone (WA):</b> ${phone ? `<code>${phone}</code>` : "<i>Tidak ada nomor</i>"}
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

    return success(res, {
      statusCode: 201,
      message: "Pesan Anda berhasil terkirim. Barber kami akan segera menghubungi Anda.",
      data: { id: entry.id },
    });
  } catch (error) {
    return sendError(res, { message: "Gagal mengirim pesan. Silakan coba lagi." });
  }
};

/**
 * GET /api/v1/waitlist (Admin only)
 * Lihat daftar antrian yang masuk.
 */
exports.getWaitlist = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.waitlist.count(),
      prisma.waitlist.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return success(res, {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
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
    return success(res, { message: "Antrian ditandai sudah ditangani." });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

/**
 * DELETE /api/v1/waitlist/:id (Admin only)
 * Hapus data antrian.
 */
exports.deleteWaitlist = async (req, res) => {
  try {
    await prisma.waitlist.delete({
      where: { id: req.params.id },
    });
    return success(res, { message: "Data berhasil dihapus." });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
/**
 * GET /api/v1/waitlist/status
 * Cek apakah user saat ini punya antrian yang belum ditangani.
 */
exports.checkStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return success(res, { data: { hasPending: false } });
    }

    const pending = await prisma.waitlist.findFirst({
      where: {
        userId,
        is_handled: false,
      },
    });

    return success(res, {
      data: { hasPending: !!pending },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

/**
 * GET /api/v1/waitlist/unhandled-count
 * Ambil jumlah feedback yang belum ditangani.
 */
exports.getUnhandledCount = async (req, res) => {
  try {
    const count = await prisma.waitlist.count({
      where: { is_handled: false },
    });

    return success(res, {
      data: { count },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
