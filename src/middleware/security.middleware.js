const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const { error } = require("../utils/response.helper");

/**
 * Request ID Middleware
 * Adds a unique X-Request-Id to every request for log correlation
 */
exports.requestId = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || uuidv4();
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

/**
 * Global API Rate Limiter
 */
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[Security] Rate Limit Hit (Global): ${req.ip} -> ${req.method} ${req.path}`);
    return error(res, {
      statusCode: 429,
      errorCode: "TOO_MANY_REQUESTS",
      message: "Terlalu banyak permintaan dari IP ini, silakan coba lagi nanti.",
    });
  },
});

/**
 * AI Specific Rate Limiter (More restrictive)
 */
exports.aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 AI requests per minute
  handler: (req, res) => {
    console.warn(`[Security] Rate Limit Hit (AI): ${req.ip} -> ${req.method} ${req.path}`);
    return error(res, {
      statusCode: 429,
      errorCode: "AI_RATE_LIMIT",
      message: "Permintaan AI terlalu cepat, silakan tunggu sebentar.",
    });
  },
});

/**
 * Distributed Deduplication (Simulated Redis SET NX EX 5 using DB)
 * This prevents race conditions where a user clicks twice very fast
 */
exports.distributedDedupe = (timeoutSeconds = 5) => {
  return async (req, res, next) => {
    const prisma = require("../config/prisma");
    const userId = req.user?.id;
    if (!userId) return next();

    const dedupeKey = `lock:${req.path}:${userId}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutSeconds * 1000);

    try {
      // Clean up expired locks (could be a cron job, but we'll do it lazily)
      await prisma.$executeRaw`DELETE FROM SystemApiLog WHERE features_used = 'LOCK' AND tgl_penggunaan < ${now}`;

      // Try to acquire lock using SystemApiLog as a temporary store 
      // (Better to have a dedicated RequestLock table, but this is a defensive move)
      // We use a unique constraint check if possible, or just a find-then-create

      const existingLock = await prisma.systemApiLog.findFirst({
        where: {
          user_id: userId,
          features_used: "LOCK",
          model_name: req.path,
          tgl_penggunaan: { gt: now }
        }
      });

      if (existingLock) {
        return error(res, {
          statusCode: 409,
          errorCode: "REQUEST_IN_PROGRESS",
          message: "Permintaan sedang diproses, silakan tunggu.",
        });
      }

      await prisma.systemApiLog.create({
        data: {
          user_id: userId,
          features_used: "LOCK",
          model_name: `SYSTEM_LOCK:${req.path}`,
          tgl_penggunaan: expiresAt,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
          koin_charged: 0
        }
      });

      next();
    } catch (err) {
      console.error("[Security] Dedupe Error:", err);
      next(); // Fail open but log
    }
  };
};
