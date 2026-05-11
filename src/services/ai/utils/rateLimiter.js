const userCooldownMap = new Map();
const COOLDOWN_MS = 5000;

/**
 * Mengecek apakah user masih dalam masa cooldown.
 * @param {string} userId 
 * @throws {Error} 429 if cooling down
 */
const checkRateLimit = (userId) => {
  const now = Date.now();
  const lastRequest = userCooldownMap.get(userId);

  if (lastRequest && now - lastRequest < COOLDOWN_MS) {
    const err = new Error(`Terlalu cepat. Tunggu ${Math.ceil((COOLDOWN_MS - (now - lastRequest)) / 1000)} detik lagi.`);
    err.statusCode = 429;
    throw err;
  }

  userCooldownMap.set(userId, now);

  // Cleanup map if too large
  if (userCooldownMap.size > 10000) {
    const cutoff = now - COOLDOWN_MS * 2;
    for (const [uid, ts] of userCooldownMap.entries()) {
      if (ts < cutoff) userCooldownMap.delete(uid);
    }
  }
};

module.exports = { checkRateLimit };
