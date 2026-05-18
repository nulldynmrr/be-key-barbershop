const FEATURE_GATE_MAP = {
  STANDARD_SCAN: "featStandardScan",
  FACE_HEATMAP: "featFaceHeatmap",
  SYMMETRY: "featSymmetry",
  ADV_MAPPING: "featAdvMapping",
  HAIR_ANALYSIS: "featHairAnalysis",
  RISK_ANALYSIS: "featRiskAnalysis",
  BARBER_INSTRUCTIONS: "featBarberInstructions",
  VIRTUAL_TRY_ON: "featVirtualTryOn",
  HISTORY: "featHistory",
  TREND_ANALYSIS: "featTrendAnalysis",
};

const FREE_TRIAL_BLOCKED_FEATURES = [
  "SYMMETRY",
  "FACE_HEATMAP",
  "ADV_MAPPING",
  "HAIR_ANALYSIS",
  "RISK_ANALYSIS",
  "BARBER_INSTRUCTIONS",
  "TREND_ANALYSIS",
  "VIRTUAL_TRY_ON",
];

module.exports = {
  FEATURE_GATE_MAP,
  FREE_TRIAL_BLOCKED_FEATURES,
};
