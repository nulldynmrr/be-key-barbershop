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

    const real = calculateRealBilling(usageNorm, configImageGen, billingBase, 0);
    let imageGenCostUsd = real.realCostUsd;
    let imageGenKoin = real.realKoinAi;

    const successCount = generatedImageUrls.filter(Boolean).length;
    if (real.realCostUsd === 0 && successCount > 0 && configImageGen.pricingUnit === "IMAGE") {
      const per = Number(configImageGen.hargaPerImage) || 0;
      if (per > 0) {
        const fb = calculateImageGenBilling(per * successCount, billingBase);
        imageGenCostUsd = per * successCount;
        imageGenKoin = fb.imageGenKoin;
      }
    }

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
