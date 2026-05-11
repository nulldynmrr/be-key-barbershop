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
 */
const calculateRealBilling = (usage, configAi, billingBase, totalKoinFitur) => {
  const { prompt_tokens = 0, completion_tokens = 0 } = usage || {};
  const { rateIdr, multiplier, hargaPerKoinIdr } = billingBase;
  
  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;

  const realCostUsd =
    configAi.pricingUnit === "IMAGE"
      ? (prompt_tokens / 1_000_000) * tarifIn + (Number(configAi.hargaPerImage) || 0)
      : (prompt_tokens / 1_000_000) * tarifIn + (completion_tokens / 1_000_000) * tarifOut;

  const realCostIdr = realCostUsd * rateIdr * multiplier;
  const realKoinAi = Math.ceil(realCostIdr / hargaPerKoinIdr);
  
  return { realCostUsd, realKoinAi, totalDipotong: totalKoinFitur + realKoinAi };
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

module.exports = { estimateBilling, calculateRealBilling, calculateImageGenBilling };
