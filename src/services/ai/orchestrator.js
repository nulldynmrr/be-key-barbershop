const { PrismaClient } = require("@prisma/client");
const cache = require("../../utils/memoryCache");
const fs = require("fs");
const path = require("path");

const { checkRateLimit } = require("./utils/rateLimiter");
const { compressImageIfNeeded } = require("./utils/imageProcessor");
const { buildDynamicPrompt } = require("./core/promptBuilder");
const { callAiLLM } = require("./core/aiClient");
const { generateVirtualTryOn } = require("./core/imageGenClient");
const { estimateBilling, calculateRealBilling, calculateImageGenBilling } = require("./billing");

const prisma = new PrismaClient();

const FEATURE_GATE_MAP = {
  STANDARD_SCAN:        "featStandardScan",
  FACE_HEATMAP:         "featFaceHeatmap",
  SYMMETRY:             "featSymmetry",
  ADV_MAPPING:          "featAdvMapping",
  HAIR_ANALYSIS:        "featHairAnalysis",
  RISK_ANALYSIS:        "featRiskAnalysis",
  BARBER_INSTRUCTIONS:  "featBarberInstructions",
  VIRTUAL_TRY_ON:       "featVirtualTryOn",
  HISTORY:              "featHistory",
  TREND_ANALYSIS:       "featTrendAnalysis",
};

/**
 * Main Orchestrator for Face Analysis Process
 * Modularized but keeping 100% original business logic.
 */
const processFaceAnalysis = async (userId, file, requestedFeatures) => {
  // 1. Rate Limiting (userCooldownMap)
  checkRateLimit(userId);

  // 2. Image Processing (Sharp Compression & MAX_FILE_SIZE)
  await compressImageIfNeeded(file);

  // 3. Load Configurations & User Data (Parallel)
  const [user, sysConfigFromDb, pricingListFromDb, configAiFromDb, configImageGenFromDb] = await Promise.all([
    prisma.user.findUnique({ 
      where: { id: userId }, 
      include: { 
        active_package: { include: { llmModel: true, imageModel: true } } 
      } 
    }),
    cache.get("sysConfig") ? null : prisma.systemConfig.findFirst(),
    cache.get("pricingList") ? null : prisma.featurePricing.findMany(),
    cache.get("configAi") ? null : prisma.aiModel.findFirst({ where: { isActive: true, typeAi: "LLM" } }),
    prisma.aiModel.findFirst({ where: { isActive: true, typeAi: { in: ["IMAGE", "IMAGE_GEN"] } } })
  ]);

  const sysConfig = cache.get("sysConfig") || sysConfigFromDb;
  const pricingList = cache.get("pricingList") || pricingListFromDb;
  const configAi = user?.active_package?.llmModel || cache.get("configAi") || configAiFromDb;
  const configImageGen = user?.active_package?.imageModel || configImageGenFromDb;

  if (sysConfigFromDb) cache.set("sysConfig", sysConfig, 300);
  if (pricingListFromDb) cache.set("pricingList", pricingList, 300);
  if (configAiFromDb) cache.set("configAi", configAi, 300);

  if (!configAi) {
    const err = new Error("Konfigurasi AI belum diatur Admin.");
    err.statusCode = 500;
    throw err;
  }

  // 4. Handle Package & Free Trial Logic (MATCHING ORIGINAL LOGIC)
  let userPackage = user?.active_package;
  if (!userPackage) {
    if (user && user.tipe_akun === 'free' && user.sisa_credit > 0) {
      userPackage = {
        namaPaket: "Free Trial",
        featStandardScan: true,
        featFaceHeatmap: false,
        featSymmetry: false,
        featAdvMapping: false,
        featHairAnalysis: false,
        featRiskAnalysis: false,
        featBarberInstructions: false,
        featVirtualTryOn: true,
        virtualTryOnLimit: 1,
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

  // 5. Feature Gating
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

    // HARD OVERRIDE FOR FREE TRIAL USERS (Exact list from original)
    const premiumFeatures = [
      "SYMMETRY", "FACE_HEATMAP", "ADV_MAPPING", 
      "HAIR_ANALYSIS", "RISK_ANALYSIS", 
      "BARBER_INSTRUCTIONS", "TREND_ANALYSIS"
    ];
    if (isFreeTrial && premiumFeatures.includes(code)) continue; 

    if (!userPackage[col]) {
      deniedByPackage.push(code);
      continue;
    }
    activeFeatures.push(code);
  }

  if (deniedByPackage.length > 0) {
    const err = new Error(`Akses Ditolak: Fitur ${deniedByPackage.map((f) => `'${f}'`).join(", ")} tidak termasuk dalam paket '${userPackage.namaPaket}' Anda.`);
    err.statusCode = 403;
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

  // 6. Pre-check Billing (estimate)
  const billingBase = estimateBilling(activeFeatures, pricingList, sysConfig, userPackage, configAi);
  if (!isFreeTrial && user.sisa_credit < billingBase.minKoinRequired) {
    const err = new Error(`Credit tidak mencukupi. Estimasi butuh ${billingBase.minKoinRequired} koin (Fitur: ${billingBase.totalKoinFitur}, Token AI: ${billingBase.estKoinAi}). Sisa: ${user.sisa_credit}.`);
    err.statusCode = 402;
    throw err;
  }

  // 7. Save Original Image
  const imageBase64 = file.buffer.toString("base64");
  const cleanName = file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.-]/g, "").substring(0, 50);
  const url_foto_upload = `/uploads/ai_results/${Date.now()}-${cleanName}`;
  const uploadDir = path.join(process.cwd(), "uploads", "ai_results");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), url_foto_upload), file.buffer);

  // 8. Build Prompt & Call LLM (modular)
  const { systemInstruction, promptText } = buildDynamicPrompt(activeFeatures);
  const aiRawResponse = await callAiLLM(configAi, systemInstruction, promptText, imageBase64, file.mimetype, userId);
  
  const hasil_analisis = JSON.parse(aiRawResponse.choices[0].message.content);
  const usage = aiRawResponse.usage || {};

  // 9. Post-LLM Billing Calculation
  const realBilling = calculateRealBilling(usage, configAi, billingBase, billingBase.totalKoinFitur);
  let totalDipotong = realBilling.totalDipotong;

  // 10. Virtual Try-On (if active)
  let generatedImageUrls = [];
  let imageGenCostUsd = 0;
  let imageGenUsage = {};
  let imageGenKoin = 0;

  if (activeFeatures.includes("VIRTUAL_TRY_ON") && configImageGen) {
    const tryOnResult = await generateVirtualTryOn(configImageGen, file, hasil_analisis, userPackage, isFreeTrial, cleanName, url_foto_upload);
    generatedImageUrls = tryOnResult.generatedImageUrls;
    imageGenCostUsd = tryOnResult.imageGenCostUsd;
    imageGenUsage = tryOnResult.imageGenUsage;

    if (imageGenCostUsd > 0) {
      const igBilling = calculateImageGenBilling(imageGenCostUsd, billingBase);
      imageGenKoin = igBilling.imageGenKoin;
      totalDipotong += imageGenKoin;
      console.log(`[Image Gen Billing] cost_usd=${imageGenCostUsd}, cost_idr=${igBilling.imageGenCostIdr.toFixed(2)}, koin=${imageGenKoin}, new_total=${totalDipotong}`);
    }
  }

  const mockTryOnImage = activeFeatures.includes("VIRTUAL_TRY_ON") ? generatedImageUrls : null;
  const saveToHistory = activeFeatures.includes("HISTORY");

  // 11. Database Transaction (STRICT CONSTRAINTS)
  const resultTx = await prisma.$transaction(async (tx) => {
    let aiRecord = null;
    if (saveToHistory) {
      aiRecord = await tx.aIGeneration.create({
        data: { 
          user_id: userId, 
          url_foto_upload, 
          url_hasil_img: mockTryOnImage,
          hasil_analisis, 
          harga_credit_terpakai: totalDipotong 
        },
      });
    }

    await tx.systemApiLog.create({
      data: {
        model_name: configAi.modelName,
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        cost_usd: realBilling.realCostUsd,
        koin_charged: billingBase.totalKoinFitur + realBilling.realKoinAi,
        service_fee_koin: billingBase.totalKoinFitur,
        token_fee_koin: realBilling.realKoinAi,
        features_used: JSON.stringify(activeFeatures),
        user_id: userId,
        ai_generation_id: aiRecord?.id || null,
      },
    });

    if (imageGenCostUsd > 0 && configImageGen) {
      await tx.systemApiLog.create({
        data: {
          model_name: configImageGen.modelName,
          input_tokens: imageGenUsage.prompt_tokens || 1,
          output_tokens: imageGenUsage.completion_tokens || 1,
          total_tokens: imageGenUsage.total_tokens || 2,
          cost_usd: imageGenCostUsd,
          koin_charged: imageGenKoin,
          service_fee_koin: 0,
          token_fee_koin: imageGenKoin,
          features_used: JSON.stringify(["VIRTUAL_TRY_ON"]),
          user_id: userId,
          ai_generation_id: aiRecord?.id || null,
        },
      });
    }

    const amountToDeduct = isFreeTrial ? user.sisa_credit : totalDipotong;
    await tx.user.update({
      where: { id: userId },
      data: { sisa_credit: { decrement: amountToDeduct } },
    });

    return aiRecord;
  });

  // 12. Final Return (Matching original result object)
  return {
    kualitas_ok: hasil_analisis.kualitas_foto_ok,
    alasan: hasil_analisis.alasan_kualitas || null,
    totalDipotong,
    totalKoinFitur: billingBase.totalKoinFitur,
    realKoinAi: realBilling.realKoinAi,
    imageGenKoin,
    activeFeatures,
    hasil_analisis,
    resultTx,
    total_tokens: usage.total_tokens || 0,
    realCostUsd: realBilling.realCostUsd,
    url_foto_upload,
    url_hasil_img: mockTryOnImage,
  };
};

module.exports = { processFaceAnalysis };
