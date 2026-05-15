const fs = require("fs");
const path = require("path");

const prisma = require("../../../../config/prisma");
const cache = require("../../../../utils/memoryCache");
const { reportSystemError } = require("../../../alert.service");
const { checkRateLimit } = require("../../utils/rateLimiter");
const { compressImageIfNeeded } = require("../../utils/imageProcessor");
const { estimateBilling } = require("../../billing");
const { FEATURE_GATE_MAP, FREE_TRIAL_BLOCKED_FEATURES } = require("../../featureGateMap");
const { assertValidAnalyzeUpload } = require("../../inputValidation");

const billingNode = async (state) => {
  const { userId, file, requestedFeatures } = state;

  assertValidAnalyzeUpload(state);

  // Ensure buffer exists for downstream nodes (LLM/Sharp)
  if (!file.buffer && file.path) {
    file.buffer = fs.readFileSync(file.path);
  }

  await checkRateLimit(userId);

  await compressImageIfNeeded(file);

  const [user, sysConfigFromDb, pricingListFromDb, configAiFromDb, configImageGenFromDb] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { active_package: { include: { llmModel: true, imageModel: true } } },
    }),
    cache.get("sysConfig") ? null : prisma.systemConfig.findFirst(),
    cache.get("pricingList") ? null : prisma.featurePricing.findMany(),
    cache.get("configAi") ? null : prisma.aiModel.findFirst({ where: { isActive: true, typeAi: "LLM" } }),
    prisma.aiModel.findFirst({ where: { isActive: true, typeAi: { in: ["IMAGE", "IMAGE_GEN"] } } }),
  ]);

  const sysConfig = cache.get("sysConfig") || sysConfigFromDb;
  const pricingList = cache.get("pricingList") || pricingListFromDb;
  const configAi = user?.active_package?.llmModel || cache.get("configAi") || configAiFromDb;
  const configImageGen = user?.active_package?.imageModel || configImageGenFromDb;

  if (sysConfigFromDb) cache.set("sysConfig", sysConfig, 300);
  if (pricingListFromDb) cache.set("pricingList", pricingList, 300);
  if (configAiFromDb) cache.set("configAi", configAi, 300);

  if (!configAi) {
    reportSystemError(
      "AI_ORCHESTRATOR",
      "🚨 SERVICE DOWN: Tidak ada model AI (LLM) yang aktif!",
      "CRITICAL",
    ).catch(() => { });
    const err = new Error("Layanan AI sedang dalam pemeliharaan. Tim kami sedang menanganinya.");
    err.statusCode = 503;
    err.errorCode = "SERVICE_UNAVAILABLE";
    throw err;
  }

  let userPackage = user?.active_package;
  if (!userPackage) {
    if (user && user.tipe_akun === "free" && user.sisa_credit > 0) {
      userPackage = {
        namaPaket: "Free Trial",
        featStandardScan: true,
        featFaceHeatmap: false,
        featSymmetry: false,
        featAdvMapping: false,
        featHairAnalysis: false,
        featRiskAnalysis: false,
        featBarberInstructions: false,
        featVirtualTryOn: false,
        virtualTryOnLimit: 0,
        featHistory: true,
        featTrendAnalysis: false,
        hargaNominal: 750,
        jumlahKoin: 3,
      };
    } else {
      const err = new Error("Anda belum memiliki paket aktif. Silakan beli paket terlebih dahulu.");
      err.statusCode = 403;
      throw err;
    }
  }

  const isFreeTrial = userPackage.namaPaket === "Free Trial";

  const globalStatus = {};
  for (const fp of pricingList) {
    globalStatus[fp.featureCode] = fp.isActive;
  }

  const activeFeatures = [];
  const deniedByPackage = [];

  for (const feature of requestedFeatures) {
    const code = feature.toUpperCase();
    const col = FEATURE_GATE_MAP[code];
    if (!col) {
      const err = new Error(`Fitur '${feature}' tidak dikenal.`);
      err.statusCode = 400;
      throw err;
    }
    if (globalStatus[code] === false) continue;
    if (isFreeTrial && FREE_TRIAL_BLOCKED_FEATURES.includes(code)) continue;
    if (!userPackage[col]) {
      deniedByPackage.push(code);
      continue;
    }
    activeFeatures.push(code);
  }

  if (deniedByPackage.length > 0) {
    const err = new Error(
      `Akses Ditolak: Fitur ${deniedByPackage.map((f) => `'${f}'`).join(", ")} tidak termasuk dalam paket '${userPackage.namaPaket}' Anda.`,
    );
    err.statusCode = 403;
    throw err;
  }

  if (activeFeatures.includes("VIRTUAL_TRY_ON") && !configImageGen) {
    reportSystemError(
      "AI_ORCHESTRATOR",
      "🚨 SERVICE DOWN: Fitur Virtual Try-On diminta, tetapi tidak ada model Image Gen aktif!",
      "CRITICAL",
    ).catch(() => { });
    const err = new Error("Layanan AI (Image Gen) sedang dalam pemeliharaan.");
    err.statusCode = 503;
    err.errorCode = "SERVICE_UNAVAILABLE";
    throw err;
  }

  if (!activeFeatures.includes("STANDARD_SCAN")) {
    if (globalStatus["STANDARD_SCAN"] === false) {
      const err = new Error("Fitur analisis dasar (STANDARD_SCAN) sedang dinonaktifkan oleh Admin.");
      err.statusCode = 503;
      throw err;
    }
    activeFeatures.unshift("STANDARD_SCAN");
  }

  const billingBase = estimateBilling(activeFeatures, pricingList, sysConfig, userPackage, configAi);

  if (!isFreeTrial && user.sisa_credit < billingBase.minKoinRequired) {
    const err = new Error(
      `Credit tidak mencukupi. Estimasi butuh ${billingBase.minKoinRequired} koin (Fitur: ${billingBase.totalKoinFitur}, Token AI: ${billingBase.estKoinAi}). Sisa: ${user.sisa_credit}.`,
    );
    err.statusCode = 402;
    throw err;
  }

  const imageBase64 = file.buffer.toString("base64");

  // Use existing path if it's already in ai_results (from Multer + OptimizeImage)
  let url_foto_upload = "";
  const relativeFromPath = file.path ? file.path.replace(/\\/g, "/").replace(/.*uploads\/ai_results\//, "uploads/ai_results/") : null;

  if (relativeFromPath && relativeFromPath.includes("uploads/ai_results/")) {
    url_foto_upload = `/${relativeFromPath}`;
  } else {
    // Fallback: Save buffer to ai_results if path is missing or elsewhere
    const rawName = file.originalname || "camera-capture.jpg";
    const cleanName = rawName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.-]/g, "").substring(0, 50);
    const fileName = `${Date.now()}-${cleanName}${file.mimetype === "image/webp" ? ".webp" : ""}`;
    const uploadDir = path.join(process.cwd(), "uploads", "ai_results");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, file.buffer);
    url_foto_upload = `/uploads/ai_results/${fileName}`;
  }

  const cleanName = path.basename(url_foto_upload);

  if (url_foto_upload.length > 500) {
    console.error(`[BillingNode] CRITICAL: url_foto_upload is too long (${url_foto_upload.length}). Truncating to prevent DB error. Content starts with: ${url_foto_upload.substring(0, 50)}`);
    url_foto_upload = url_foto_upload.substring(0, 500);
  }

  return {
    user,
    sysConfig,
    pricingList,
    configAi,
    configImageGen,
    userPackage,
    isFreeTrial,
    activeFeatures,
    billingBase,
    url_foto_upload,
    imageBase64,
    cleanName,
    sisa_credit_before: user.sisa_credit,
  };
};

module.exports = { billingNode };
