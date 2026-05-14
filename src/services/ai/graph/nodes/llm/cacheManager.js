const cache = require("../../../../../utils/memoryCache");
const prisma = require("../../../../../config/prisma");
const { cloneJsonSafe } = require("../../../utils/cloneJsonSafe");
const { calculateRealBilling } = require("../../../billing");

const MS_PER_DAY = 86400000;

exports.getCache = async ({ imageFingerprint, featureFingerprint, refreshWindowDays, configAi, billingBase, userId }) => {
  const cacheKey = `ai_result:${imageFingerprint}:${featureFingerprint}`;

  // 1. Memory Cache
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    const realBilling = calculateRealBilling(
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      configAi,
      billingBase,
      billingBase.totalKoinFitur,
    );
    return { hasil_analisis: cachedResult, realBilling, hit: "RAM" };
  }

  // 2. DB Cache
  try {
    const existing = await prisma.aIGeneration.findFirst({
      where: {
        user_id: userId,
        image_hash: imageFingerprint,
        feature_fingerprint: featureFingerprint,
      },
      orderBy: { tgl_generate: "desc" },
      select: { hasil_analisis: true, tgl_generate: true },
    });

    if (existing?.hasil_analisis) {
      const ageDays = (Date.now() - new Date(existing.tgl_generate).getTime()) / MS_PER_DAY;

      if (ageDays < refreshWindowDays) {
        const fromDb = cloneJsonSafe(existing.hasil_analisis);
        if (fromDb) {
          cache.set(cacheKey, fromDb, 86400);
          const realBilling = calculateRealBilling(
            { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            configAi,
            billingBase,
            billingBase.totalKoinFitur,
          );
          return { hasil_analisis: fromDb, realBilling, hit: "DB" };
        }
      }
      return { staleAnalysis: cloneJsonSafe(existing.hasil_analisis) };
    }
  } catch (e) {
    console.warn("[LLM Cache] DB lookup failed:", e.message);
  }

  return null;
};

exports.setCache = (imageFingerprint, featureFingerprint, data) => {
  const cacheKey = `ai_result:${imageFingerprint}:${featureFingerprint}`;
  cache.set(cacheKey, data, 86400);
};
