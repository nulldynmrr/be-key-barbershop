const { Annotation } = require("@langchain/langgraph");

const FaceAnalysisStateAnnotation = Annotation.Root({
  // Input dari orchestrator 
  userId: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  file: Annotation({
    // Multer file object (buffer, mimetype, originalname, size)
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  requestedFeatures: Annotation({
    value: (_, newVal) => newVal,
    default: () => [],
  }),
  source: Annotation({
    value: (_, newVal) => newVal,
    default: () => "file",
  }),

  // Diisi billingNode; diperlukan node berikutnya 
  user: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  sysConfig: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  pricingList: Annotation({
    value: (_, newVal) => newVal,
    default: () => [],
  }),
  configAi: Annotation({
    // LLM model config dari DB
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  configImageGen: Annotation({
    // Image gen model config dari DB (nullable)
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  userPackage: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  isFreeTrial: Annotation({
    value: (_, newVal) => newVal,
    default: () => false,
  }),
  activeFeatures: Annotation({
    // Feature codes yang sudah lolos gate check
    value: (_, newVal) => newVal,
    default: () => [],
  }),
  billingBase: Annotation({
    // Output dari estimateBilling() — diisi billingNode
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  url_foto_upload: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  imageBase64: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  cleanName: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),

  /** SHA-256 hex buffer foto (pasca-kompresi), untuk dedupe DB + RAM */
  imageFingerprint: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  /** SHA-256 hex daftar fitur aktif (sorted), supaya cache tidak tertukar antar paket fitur */
  featureFingerprint: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),

  // diisi oleh llmNode 
  hasil_analisis: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
  llmUsage: Annotation({
    // { prompt_tokens, completion_tokens, total_tokens }
    value: (_, newVal) => newVal,
    default: () => ({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
  }),
  realBilling: Annotation({
    // Output dari calculateRealBilling()
    value: (_, newVal) => newVal,
    default: () => null,
  }),

  // Diisi oleh imageGenNode 
  generatedImageUrls: Annotation({
    value: (_, newVal) => newVal,
    default: () => [],
  }),
  imageGenCostUsd: Annotation({
    value: (_, newVal) => newVal,
    default: () => 0,
  }),
  imageGenUsage: Annotation({
    value: (_, newVal) => newVal,
    default: () => ({}),
  }),
  imageGenKoin: Annotation({
    value: (_, newVal) => newVal,
    default: () => 0,
  }),

  // Final state 
  totalDipotong: Annotation({
    value: (_, newVal) => newVal,
    default: () => 0,
  }),
  sisa_credit_before: Annotation({
    value: (_, newVal) => newVal,
    default: () => 0,
  }),
  sisa_credit_after: Annotation({
    value: (_, newVal) => newVal,
    default: () => 0,
  }),
  resultTx: Annotation({
    // AIGeneration record dari DB 
    value: (_, newVal) => newVal,
    default: () => null,
  }),

  // Error propagation 
  error: Annotation({
    value: (_, newVal) => newVal,
    default: () => null,
  }),
});

module.exports = { FaceAnalysisStateAnnotation };
