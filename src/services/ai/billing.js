/**
 * Menyatukan blok `usage` dari respons OpenAI / MAIA / Gemini-compatible ke angka integer.
 * Router bisa mengirim prompt_tokens atau input_tokens, dst.
 * @param {Record<string, unknown>|null|undefined} usage
 * @returns {{ prompt_tokens: number, completion_tokens: number, total_tokens: number }}
 */
function normalizeOpenAiCompatibleUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }

  const prompt_tokens = Math.round(
    Number(
      usage.prompt_tokens ??
        usage.input_tokens ??
        usage.prompt_token_count ??
        usage.cache_creation_input_tokens ??
        0,
    ),
  );

  const completion_tokens = Math.round(
    Number(
      usage.completion_tokens ??
        usage.output_tokens ??
        usage.completion_token_count ??
        usage.candidates_tokens ??
        0,
    ),
  );

  let total_tokens = Math.round(
    Number(usage.total_tokens ?? usage.total_token_count ?? usage.totalTokenCount ?? 0),
  );

  if (!total_tokens && (prompt_tokens || completion_tokens)) {
    total_tokens = prompt_tokens + completion_tokens;
  }

  return { prompt_tokens, completion_tokens, total_tokens };
}

/**
 * Menghitung estimasi koin yang dibutuhkan sebelum pemanggilan AI.
 */
const estimateBilling = (activeFeatures, pricingList, sysConfig, userPackage, configAi) => {
  let totalKoinFitur = 0;
  for (const code of activeFeatures) {
    const fp = pricingList.find((p) => p.featureCode === code && p.isActive);
    if (fp) totalKoinFitur += fp.koinCost;
  }

  const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
  const multiplier = sysConfig?.globalMultiplier || 1.35;
  const hargaPerKoinIdr = userPackage.jumlahKoin > 0 ? userPackage.hargaNominal / userPackage.jumlahKoin : 250;

  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;
  const avgTokens = configAi.avgTokensPerUse || 2000;

  const estCostUsd =
    configAi.pricingUnit === "IMAGE"
      ? (avgTokens / 1_000_000) * tarifIn + (Number(configAi.hargaPerImage) || 0)
      : (avgTokens / 1_000_000) * ((tarifIn + tarifOut) / 2);

  const estCostIdr = estCostUsd * rateIdr * multiplier;
  const estKoinAi = Math.ceil(estCostIdr / hargaPerKoinIdr);
  const minKoinRequired = totalKoinFitur + estKoinAi;

  return { totalKoinFitur, estKoinAi, minKoinRequired, rateIdr, multiplier, hargaPerKoinIdr };
};

/**
 * Menghitung koin aktual berdasarkan usage token dari AI.
 * Untuk model pricingUnit "IMAGE" (image gen): jika router mengembalikan token,
 * biaya = input per 1M + output per 1M (sama logika TOKEN). Jika token 0,
 * fallback ke hargaPerImage (per generate) agar kompatibel dengan API tanpa usage.
 */
const calculateRealBilling = (usage, configAi, billingBase, totalKoinFitur, count = 1) => {
  const { prompt_tokens = 0, completion_tokens = 0 } = normalizeOpenAiCompatibleUsage(usage);
  const { rateIdr, multiplier, hargaPerKoinIdr } = billingBase;

  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;
  const perImageUsd = Number(configAi.hargaPerImage) || 0;

  const tokenUsd =
    (prompt_tokens / 1_000_000) * tarifIn + (completion_tokens / 1_000_000) * tarifOut;

  const realCostUsd =
    configAi.pricingUnit === "IMAGE"
      ? tokenUsd + (count * perImageUsd)
      : tokenUsd;

  const realCostIdr = realCostUsd * rateIdr * multiplier;
  let realKoinAi = Math.ceil(realCostIdr / hargaPerKoinIdr);
  
  // Hardening: Pastikan minimal ada 1 koin untuk token jika API berhasil dipanggil
  if (realKoinAi === 0 && (prompt_tokens > 0 || completion_tokens > 0)) {
    realKoinAi = 1;
  }

  const finalDipotong = totalKoinFitur + realKoinAi;
  
  // Business Rule: Minimal pemotongan keseluruhan adalah 2 koin untuk menjaga biaya operasional
  // kecuali jika ini adalah Free Trial (akan ditangani di node transaksi)
  const totalWithMin = Math.max(2, finalDipotong);

  return { 
    realCostUsd, 
    realKoinAi, 
    totalDipotong: totalWithMin 
  };
};

/**
 * Menghitung billing khusus Image Generation.
 */
const calculateImageGenBilling = (imageGenCostUsd, billingBase) => {
  const { rateIdr, multiplier, hargaPerKoinIdr } = billingBase;
  const imageGenCostIdr = imageGenCostUsd * rateIdr * multiplier;
  const imageGenKoin = Math.ceil(imageGenCostIdr / hargaPerKoinIdr);
  
  return { imageGenKoin, imageGenCostIdr };
};

module.exports = {
  estimateBilling,
  calculateRealBilling,
  calculateImageGenBilling,
  normalizeOpenAiCompatibleUsage,
};
