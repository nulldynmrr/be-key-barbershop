const { generateVirtualTryOn } = require("../../core/imageGenClient");
const {
  calculateRealBilling,
  calculateImageGenBilling,
  normalizeOpenAiCompatibleUsage,
} = require("../../billing");

const imageGenNode = async (state) => {
  const {
    configImageGen,
    file,
    hasil_analisis,
    userPackage,
    isFreeTrial,
    cleanName,
    url_foto_upload,
    billingBase,
  } = state;

  if (process.env.DEBUG_AI_GRAPH === "1") {
    console.log(`[LangGraph imageGenNode] Starting Virtual Try-On...`);
  }

  // [CRITICAL AUDIT] Only skip if photo is bad AND no recommendations were provided.
  // If the AI was confident enough to provide styles, we should attempt to generate images.
  const hasRecommendations = hasil_analisis?.rekomendasi_gaya && hasil_analisis.rekomendasi_gaya.length > 0;
  if (hasil_analisis?.kualitas_foto_ok === false && !hasRecommendations) {
    if (process.env.DEBUG_AI_GRAPH === "1") {
      console.log(`[LangGraph imageGenNode] Skipping image generation because photo quality is poor and no recommendations were provided.`);
    }
    return {
      generatedImageUrls: [],
      imageGenCostUsd: 0,
      imageGenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      imageGenKoin: 0,
    };
  }

  try {
    const tryOnResult = await generateVirtualTryOn(
      configImageGen,
      file,
      hasil_analisis,
      userPackage,
      isFreeTrial,
      cleanName,
      url_foto_upload,
    );

    const generatedImageUrls = tryOnResult.generatedImageUrls ?? [];
    const usageNorm = normalizeOpenAiCompatibleUsage(tryOnResult.imageGenUsage);

    if (!configImageGen) {
      return {
        generatedImageUrls,
        imageGenCostUsd: 0,
        imageGenUsage: usageNorm,
        imageGenKoin: 0,
      };
    }

    const successCount = generatedImageUrls.filter(Boolean).length;
    const real = calculateRealBilling(usageNorm, configImageGen, billingBase, 0, successCount);
    
    const imageGenCostUsd = real.realCostUsd;
    const imageGenKoin = real.realKoinAi;

    const additionalCost = imageGenKoin;

    return {
      generatedImageUrls,
      imageGenCostUsd,
      imageGenUsage: usageNorm,
      imageGenKoin,
      totalDipotong: state.totalDipotong + additionalCost,
    };
  } catch (err) {
    if (err.errorCode === "SERVICE_UNAVAILABLE" || err.statusCode === 503) {
      throw err;
    }

    console.warn(`[LangGraph imageGenNode] Non-critical error: ${err.message}. Lanjut tanpa gambar.`);
    return {
      generatedImageUrls: [],
      imageGenCostUsd: 0,
      imageGenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      imageGenKoin: 0,
    };
  }
};

module.exports = { imageGenNode };
