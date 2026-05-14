const crypto = require("crypto");
const { buildDynamicPrompt } = require("../../../core/promptBuilder");

exports.getFingerprints = (fileBuffer, activeFeatures) => {
  const imageFingerprint = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const normalizedFeatures = [...(activeFeatures || [])].map((f) => String(f).toUpperCase()).sort();
  const featureFingerprint = crypto.createHash("sha256").update(normalizedFeatures.join(",")).digest("hex");
  
  return { imageFingerprint, featureFingerprint };
};

exports.preparePrompts = (activeFeatures, staleAnalysis, refreshWindowDays) => {
  return buildDynamicPrompt(activeFeatures, {
    staleRefreshPreviousAnalysis: staleAnalysis,
    staleRefreshPeriodDays: refreshWindowDays,
  });
};
