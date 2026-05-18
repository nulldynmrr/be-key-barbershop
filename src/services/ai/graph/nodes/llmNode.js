const { getAnalysisRefreshWindowDays } = require("../../analysisRefreshWindow");
const { calculateRealBilling } = require("../../billing");
const { getCache, setCache } = require("./llm/cacheManager");
const { getFingerprints, preparePrompts } = require("./llm/promptManager");
const { invokeLLM } = require("./llm/llmInvoker");

/**
 * Optimized LLM Node for LangGraph
 * Orchestrates Cache, Prompting, and LLM Invocation
 */
const llmNode = async (state) => {
  const { userId, file, activeFeatures, configAi, billingBase, imageBase64, userPackage, isFreeTrial, source } = state;

  // 1. Validation
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const err = new Error("State graph tidak valid: buffer gambar hilang.");
    err.statusCode = 500;
    throw err;
  }
  if (!billingBase || typeof billingBase.totalKoinFitur !== "number") {
    const err = new Error("State graph tidak valid: billingBase hilang.");
    err.statusCode = 500;
    throw err;
  }

  // 2. Fingerprinting & Refresh Window
  const { imageFingerprint, featureFingerprint } = getFingerprints(file.buffer, activeFeatures);
  const refreshWindowDays = getAnalysisRefreshWindowDays(userPackage, !!isFreeTrial);

  // 3. Cache Check (RAM + DB)
  const cacheResult = await getCache({
    imageFingerprint,
    featureFingerprint,
    refreshWindowDays,
    configAi,
    billingBase,
    userId
  });

  if (cacheResult?.hasil_analisis) {
    if (process.env.DEBUG_AI_GRAPH === "1") {
      console.log(`[LLM Node] Cache HIT (${cacheResult.hit}). Hash: ${imageFingerprint.slice(0, 8)}`);
    }
    return {
      hasil_analisis: cacheResult.hasil_analisis,
      llmUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      realBilling: cacheResult.realBilling,
      totalDipotong: cacheResult.realBilling.totalDipotong,
      imageFingerprint,
      featureFingerprint,
      generatedImageUrls: cacheResult.url_hasil_img || [],
    };
  }

  // 4. LLM Invocation
  const { systemInstruction, promptText } = preparePrompts(
    activeFeatures, 
    cacheResult?.staleAnalysis, 
    refreshWindowDays,
    source
  );

  const { hasil_analisis, llmUsage } = await invokeLLM({
    configAi,
    systemInstruction,
    promptText,
    imageBase64,
    file,
    userId
  });

  // 5. Success Post-Processing
  setCache(imageFingerprint, featureFingerprint, hasil_analisis);
  
  const realBilling = calculateRealBilling(llmUsage, configAi, billingBase, billingBase.totalKoinFitur);

  let photo_violation_detected = false;
  let violation_reason = null;

  if (hasil_analisis?.jumlah_wajah > 1) {
    photo_violation_detected = true;
    violation_reason = "Fotonya hanya satu orang saja! Koin dipotong 1.";
  } else if (hasil_analisis?.jumlah_wajah === 0) {
    photo_violation_detected = true;
    violation_reason = "Wajah tidak terdeteksi secara jelas! Koin dipotong 1.";
  } else if (hasil_analisis?.kualitas_foto_ok === false) {
    photo_violation_detected = true;
    violation_reason = hasil_analisis.alasan_kualitas 
      ? `${hasil_analisis.alasan_kualitas} Koin dipotong 1.` 
      : "Kualitas foto tidak memadai! Koin dipotong 1.";
  }

  return {
    hasil_analisis,
    llmUsage,
    realBilling,
    totalDipotong: realBilling.totalDipotong,
    imageFingerprint,
    featureFingerprint,
    photo_violation_detected,
    violation_reason,
  };
};

module.exports = { llmNode };
