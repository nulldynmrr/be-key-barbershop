/**
 * Registry modul prompt per fitur — satu sumber kebenaran untuk promptBuilder.
 * Require statis agar bundler/IDE/linter mengenali dependensi (bukan require dinamis ber-string).
 *
 * Kunci harus selaras dengan kode fitur (FEATURE_GATE_MAP / activeFeatures).
 */
const FEATURE_PROMPTS = {
  FACE_HEATMAP: require("./faceHeatmap"),
  SYMMETRY: require("./symmetry"),
  ADV_MAPPING: require("./advMapping"),
  HAIR_ANALYSIS: require("./hairAnalysis"),
  RISK_ANALYSIS: require("./riskAnalysis"),
  BARBER_INSTRUCTIONS: require("./barberInstructions"),
  TREND_ANALYSIS: require("./trendAnalysis"),
  VIRTUAL_TRY_ON: require("./virtualTryOn"),
};

/** Urutan merge field (stabil): base dulu, lalu fitur dalam urutan ini */
const FEATURE_PROMPT_LOAD_ORDER = [
  "FACE_HEATMAP",
  "SYMMETRY",
  "ADV_MAPPING",
  "HAIR_ANALYSIS",
  "RISK_ANALYSIS",
  "BARBER_INSTRUCTIONS",
  "TREND_ANALYSIS",
  "VIRTUAL_TRY_ON",
];

module.exports = { FEATURE_PROMPTS, FEATURE_PROMPT_LOAD_ORDER };
