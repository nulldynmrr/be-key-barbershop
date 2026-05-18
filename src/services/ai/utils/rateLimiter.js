const COOLDOWN_MS = 5000;

const prisma = require("../../../config/prisma");

/** Mencegah dua `checkRateLimit` untuk user yang sama overlap di titik await (race tipis). */
const rateLimitCheckInFlight = new Set();

/**
 * Cooldown antar request AI per user.
 * - DB `SystemApiLog`: tahan restart & antar instance (setelah request pertama selesai menulis log).
 * - Set in-flight: kurangi race dua request paralel sebelum log pertama tertulis.
 *
 * Batas: dua worker/process masih bisa lolos race; untuk garansi keras gunakan Redis/DB row + UNIQUE.
 *
 * @param {string} userId
 * @throws {Error} 429 jika masih cooldown atau request sebelumnya masih menjalankan fase rate-limit
 */
const checkRateLimit = async (userId) => {
  if (rateLimitCheckInFlight.has(userId)) {
    const err = new Error("Permintaan analisis sedang diproses. Tunggu sebentar lalu coba lagi.");
    err.statusCode = 429;
    err.errorCode = "RATE_LIMIT_CONCURRENT";
    throw err;
  }
  rateLimitCheckInFlight.add(userId);

  try {
    const now = new Date();
    const cooldownStart = new Date(now.getTime() - COOLDOWN_MS);

    const recentRequest = await prisma.systemApiLog.findFirst({
      where: {
        user_id: userId,
        tgl_penggunaan: { gte: cooldownStart },
      },
      orderBy: { tgl_penggunaan: "desc" },
      select: { tgl_penggunaan: true },
    });

    if (!recentRequest) return;

    const elapsed = now.getTime() - new Date(recentRequest.tgl_penggunaan).getTime();
    if (elapsed >= COOLDOWN_MS || elapsed < 0) return;

    const waitMs = COOLDOWN_MS - elapsed;
    const err = new Error(`Terlalu cepat. Tunggu ${Math.ceil(waitMs / 1000)} detik lagi.`);
    err.statusCode = 429;
    err.errorCode = "RATE_LIMIT_COOLDOWN";
    throw err;
  } finally {
    rateLimitCheckInFlight.delete(userId);
  }
};

module.exports = { checkRateLimit, COOLDOWN_MS };
