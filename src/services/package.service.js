const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const convertToDays = (value, unit) => {
  if (!value || !unit) return null;
  switch (unit.toUpperCase()) {
    case "BULAN": return value * 30;
    case "TAHUN": return value * 365;
    default:      return value;
  }
};

// Kalkulasi HPP ideal berdasarkan model AI yang dipilih Admin saat membuat paket
const calculateLiveHPP = async (payload) => {
  const {
    jumlahKoin, featVirtualTryOn, virtualTryOnLimit = 1, featHistory, llmModelId, imageModelId,
    featSymmetry, featAdvMapping,
    featFaceHeatmap, featHairAnalysis, featRiskAnalysis, featBarberInstructions,
    typeValue,
  } = payload;
  const featTrendAnalysis = payload.featTrendAnalysis || payload.featHairstyleTrend || false;

  const config = await prisma.systemConfig.findFirst();
  if (!config) throw new Error("Konfigurasi Sistem belum disetting!");

  const [selectedLlm, selectedImage] = await Promise.all([
    llmModelId
      ? prisma.aiModel.findUnique({ where: { id: llmModelId } })
      : prisma.aiModel.findFirst({ where: { typeAi: "LLM", isActive: true }, orderBy: { hargaInput1M: "asc" } }),
    imageModelId
      ? prisma.aiModel.findUnique({ where: { id: imageModelId } })
      : prisma.aiModel.findFirst({ where: { typeAi: "IMAGE_GEN", isActive: true } }),
  ]);

  if (!selectedLlm) throw new Error("Model LLM belum dipilih atau tidak ditemukan!");

  const effectiveRate = config.baseRateUsdIdr * (1 + config.inflationBuffer);
  const modelToUse = featVirtualTryOn && selectedImage ? selectedImage : selectedLlm;

  // === 1. HITUNG COST LLM (Selalu Dihitung) ===
  let llmAvgTokenCostUsd = ((Number(selectedLlm.hargaInput1M) || 0) + (Number(selectedLlm.hargaOutput1M) || 0)) / 2 / 1_000_000;
  let totalEstimatedTokens = selectedLlm.avgTokensPerUse || 2000;

  if (featSymmetry)           totalEstimatedTokens += 300;
  if (featAdvMapping)         totalEstimatedTokens += 500;
  if (featHairAnalysis)       totalEstimatedTokens += 400;
  if (featRiskAnalysis)       totalEstimatedTokens += 250;
  if (featBarberInstructions) totalEstimatedTokens += 250;
  if (featFaceHeatmap)        totalEstimatedTokens += 300;
  if (featTrendAnalysis)      totalEstimatedTokens += 400;

  let costPerActionUsd = totalEstimatedTokens * llmAvgTokenCostUsd;

  // === 2. HITUNG COST IMAGE GEN (Jika Aktif) ===
  if (featVirtualTryOn && selectedImage) {
    const limit = virtualTryOnLimit > 0 ? virtualTryOnLimit : 1;
    costPerActionUsd += (Number(selectedImage.hargaPerImage) || 0) * limit;
    
    let imageTokenCost = (Number(selectedImage.hargaInput1M) || 0) / 1_000_000;
    let imageTokens = selectedImage.avgTokensPerUse || 0;
    costPerActionUsd += (imageTokens * imageTokenCost) * limit;
  }

  let costPerActionIdr = costPerActionUsd * effectiveRate;
  let historyCostIdr = featHistory ? 50 : 0;
  costPerActionIdr += historyCostIdr;

  const COIN_SCALE   = 10;
  const estimasiAksi = jumlahKoin / COIN_SCALE;
  const totalApiCostIdr = costPerActionIdr * estimasiAksi;

  const llmCostIdr = (totalEstimatedTokens * llmAvgTokenCostUsd) * effectiveRate * estimasiAksi;
  const imageCostIdr = (featVirtualTryOn && selectedImage) ? (costPerActionUsd - (totalEstimatedTokens * llmAvgTokenCostUsd)) * effectiveRate * estimasiAksi : 0;
  const storageCostIdr = historyCostIdr * estimasiAksi;

  // Logika Marketing/Keuangan:
  // Jika SUBSCRIPTION, berikan diskon pada multiplier untuk mendorong user langganan
  // Jika ONTIME, gunakan multiplier normal
  const activeMultiplier = typeValue === "SUBSCRIPTION" 
    ? config.globalMultiplier * 0.85 // Diskon 15% margin
    : config.globalMultiplier;

  const rawHppIdeal =
    (totalApiCostIdr * activeMultiplier + config.adminFeeFixed) /
    (1 - config.mdrPercentage);

  return {
    estimasiModalApi:       Math.ceil(totalApiCostIdr),
    hppIdeal:               Math.ceil(rawHppIdeal),
    estimasiAksi:           Math.floor(estimasiAksi),
    estimasiTokenPerAksi:   totalEstimatedTokens,
    costPerActionUsd:       costPerActionUsd,
    modelLlm:   selectedLlm  ? { id: selectedLlm.id,   nama: selectedLlm.namaRouter }  : null,
    modelImage: selectedImage ? { id: selectedImage.id, nama: selectedImage.namaRouter } : null,
    breakdown: {
      llmCost: Math.ceil(llmCostIdr),
      imageCost: Math.ceil(imageCostIdr),
      storageCost: Math.ceil(storageCostIdr),
      multiplier: activeMultiplier,
      adminFee: config.adminFeeFixed,
      mdrPercentage: config.mdrPercentage
    }
  };
};


const getAllPackages = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  // 1. Ambil semua model AI dan hitung penggunaannya
  const allModels = await prisma.aiModel.findMany();
  const usages = await prisma.systemApiLog.groupBy({
    by: ["model_name"],
    _sum: { cost_usd: true },
  });

  const modelUsageMap = usages.reduce((acc, curr) => {
    acc[curr.model_name] = Number(curr._sum.cost_usd || 0);
    return acc;
  }, {});

  // 2. Tentukan status tiap model (Aktif & Punya Budget)
  const modelStatusMap = allModels.reduce((acc, model) => {
    const costUsd = modelUsageMap[model.modelName] || 0;
    // Model dianggap "OK" jika aktif dan (budget tak terbatas (0) atau budget belum habis)
    const isBudgetOk = model.maxBudget === 0 || costUsd < model.maxBudget;
    acc[model.id] = model.isActive && isBudgetOk;
    return acc;
  }, {});

  // 3. Ambil paket (tanpa filter status statis)
  const [total, packages] = await Promise.all([
    prisma.subscriptionPackage.count(),
    prisma.subscriptionPackage.findMany({
      orderBy: { hargaNominal: "asc" },
      skip,
      take: limit,
      include: {
        llmModel: true,
        imageModel: true,
      },
    }),
  ]);

  const now = new Date();

  const formattedPackages = packages.map((pkg) => {
    const isPromoValid =
      pkg.promoAktif &&
      pkg.hargaDiskon &&
      pkg.diskonMulai &&
      pkg.diskonAkhir &&
      now >= new Date(pkg.diskonMulai) &&
      now <= new Date(pkg.diskonAkhir);

    let durasi_display = "Selamanya";
    if (pkg.durationDays) {
      if (pkg.durationDays % 365 === 0)      durasi_display = `${pkg.durationDays / 365} Tahun`;
      else if (pkg.durationDays % 30 === 0)  durasi_display = `${pkg.durationDays / 30} Bulan`;
      else                                   durasi_display = `${pkg.durationDays} Hari`;
    }

    let isPackageActive = true;
    
    // Cek model LLM
    if (!pkg.llmModelId || !modelStatusMap[pkg.llmModelId]) {
      isPackageActive = false;
    }
    
    // Cek model Image Gen (jika ada Virtual Try On)
    if (pkg.featVirtualTryOn) {
      if (!pkg.imageModelId || !modelStatusMap[pkg.imageModelId]) {
        isPackageActive = false;
      }
    }

    return {
      id:           pkg.id,
      nama:         pkg.namaPaket,
      tipe:         pkg.typeValue,
      koin:         pkg.jumlahKoin,
      durasi_text:  durasi_display,
      harga_asli:   pkg.hargaNominal,
      harga_bayar:  isPromoValid ? pkg.hargaDiskon : pkg.hargaNominal,
      is_promo:     !!isPromoValid,
      berakhir_pada: isPromoValid ? pkg.diskonAkhir : null,
      status:       isPackageActive ? "AKTIF" : "NONAKTIF",
      featStandardScan:       pkg.featStandardScan,
      featSymmetry:           pkg.featSymmetry,
      featAdvMapping:         pkg.featAdvMapping,
      featFaceHeatmap:        pkg.featFaceHeatmap,
      featHairAnalysis:       pkg.featHairAnalysis,
      featRiskAnalysis:       pkg.featRiskAnalysis,
      featTrendAnalysis:      pkg.featTrendAnalysis,
      featBarberInstructions: pkg.featBarberInstructions,
      featVirtualTryOn:       pkg.featVirtualTryOn,
      virtualTryOnLimit:      pkg.virtualTryOnLimit,
      featHistory:            pkg.featHistory,
    };
  });

  return {
    total,
    topup_koin:       formattedPackages.filter((p) => p.tipe === "ONTIME"),
    langganan_premium: formattedPackages.filter((p) => p.tipe === "SUBSCRIPTION"),
  };
};

const createNewPackage = async (validatedData) => {
  const durationDays =
    validatedData.typeValue === "SUBSCRIPTION"
      ? convertToDays(validatedData.durasi_value, validatedData.durasi_unit)
      : null;

  return await prisma.subscriptionPackage.create({
    data: {
      namaPaket:        validatedData.namaPaket,
      deskripsi:        validatedData.deskripsi || "",
      typeValue:        validatedData.typeValue,
      jumlahKoin:       validatedData.jumlahKoin,
      durationDays,
      featStandardScan:       validatedData.featStandardScan,
      featFaceHeatmap:        validatedData.featFaceHeatmap        || false,
      featSymmetry:           validatedData.featSymmetry            || false,
      featAdvMapping:         validatedData.featAdvMapping          || false,
      featHairAnalysis:       validatedData.featHairAnalysis        || false,
      featRiskAnalysis:       validatedData.featRiskAnalysis        || false,
      featBarberInstructions: validatedData.featBarberInstructions  || false,
      featVirtualTryOn:       validatedData.featVirtualTryOn        || false,
      virtualTryOnLimit:      validatedData.virtualTryOnLimit       || 1,
      featHistory:            validatedData.featHistory             || false,
      featTrendAnalysis:      validatedData.featTrendAnalysis       || false,
      llmModelId:       validatedData.llmModelId   || null,
      imageModelId:     validatedData.imageModelId || null,
      hppIdeal:         validatedData.hppIdeal,
      hargaNominal:     validatedData.hargaNominal,
      promoAktif:       validatedData.promoAktif,
      hargaDiskon:      validatedData.promoAktif ? validatedData.hargaDiskon : null,
      diskonMulai:      validatedData.promoAktif && validatedData.diskonMulai ? new Date(validatedData.diskonMulai) : null,
      diskonAkhir:      validatedData.promoAktif && validatedData.diskonAkhir ? new Date(validatedData.diskonAkhir) : null,
      hppBreakdown:     validatedData.hppBreakdown || null,
      status:           "AKTIF",
    },
  });
};


const updatePackageById = async (id, validatedData) => {
  const existingPackage = await prisma.subscriptionPackage.findUnique({ where: { id } });
  if (!existingPackage) {
    const error = new Error("Paket tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  let durationDays = existingPackage.durationDays;
  if (validatedData.typeValue === "SUBSCRIPTION" && validatedData.durasi_value) {
    durationDays = convertToDays(validatedData.durasi_value, validatedData.durasi_unit);
  }

  const updateData = { ...validatedData };
  delete updateData.durasi_value;
  delete updateData.durasi_unit;

  if (updateData.diskonMulai) updateData.diskonMulai = new Date(updateData.diskonMulai);
  if (updateData.diskonAkhir) updateData.diskonAkhir = new Date(updateData.diskonAkhir);

  return await prisma.subscriptionPackage.update({
    where: { id },
    data: { ...updateData, durationDays },
  });
};

const deletePackageById = async (id) => {
  const existingPackage = await prisma.subscriptionPackage.findUnique({ where: { id } });
  if (!existingPackage) {
    const error = new Error("Paket tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }
  return await prisma.subscriptionPackage.delete({ where: { id } });
};

const togglePackageStatus = async (id, status) => {
  const existingPackage = await prisma.subscriptionPackage.findUnique({ 
    where: { id },
    include: { llmModel: true, imageModel: true }
  });
  
  if (!existingPackage) {
    const error = new Error("Paket tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  // Jika mau diaktifkan, pastikan model AI yang dipakai dalam keadaan aktif
  if (status === "AKTIF") {
    if (existingPackage.llmModelId && existingPackage.llmModel && !existingPackage.llmModel.isActive) {
      const error = new Error(`Model LLM (${existingPackage.llmModel.modelName}) sedang non-aktif. Aktifkan model tersebut terlebih dahulu.`);
      error.statusCode = 400;
      throw error;
    }
    if (existingPackage.featVirtualTryOn && existingPackage.imageModelId && existingPackage.imageModel && !existingPackage.imageModel.isActive) {
      const error = new Error(`Model Image Gen (${existingPackage.imageModel.modelName}) sedang non-aktif. Aktifkan model tersebut terlebih dahulu.`);
      error.statusCode = 400;
      throw error;
    }
  }

  return await prisma.subscriptionPackage.update({
    where: { id },
    data: { status },
  });
};

module.exports = {
  calculateLiveHPP,
  getAllPackages,
  createNewPackage,
  updatePackageById,
  deletePackageById,
  togglePackageStatus
};
