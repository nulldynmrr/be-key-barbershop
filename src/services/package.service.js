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
    jumlahKoin, featVirtualTryOn, featHistory, llmModelId, imageModelId,
    featSymmetry, featAdvMapping,
    featFaceHeatmap, featHairAnalysis, featRiskAnalysis, featBarberInstructions,
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

  let avgTokenCostUsd = 0;
  if (modelToUse.pricingUnit === "IMAGE") {
    avgTokenCostUsd = (Number(modelToUse.hargaInput1M) || 0) / 1_000_000;
  } else {
    avgTokenCostUsd = ((Number(modelToUse.hargaInput1M) || 0) + (Number(modelToUse.hargaOutput1M) || 0)) / 2 / 1_000_000;
  }

  let totalEstimatedTokens = modelToUse.avgTokensPerUse || 2000;
  if (featSymmetry)           totalEstimatedTokens += 300;
  if (featAdvMapping)         totalEstimatedTokens += 500;
  if (featHairAnalysis)       totalEstimatedTokens += 400;
  if (featRiskAnalysis)       totalEstimatedTokens += 250;
  if (featBarberInstructions) totalEstimatedTokens += 250;
  if (featFaceHeatmap)        totalEstimatedTokens += 300;
  if (featTrendAnalysis)      totalEstimatedTokens += 400;

  let costPerActionUsd = totalEstimatedTokens * avgTokenCostUsd;
  if (modelToUse.pricingUnit === "IMAGE") {
    costPerActionUsd += (Number(modelToUse.hargaPerImage) || 0);
  }

  let costPerActionIdr = costPerActionUsd * effectiveRate;
  if (featHistory) costPerActionIdr += 50;

  const COIN_SCALE   = 10;
  const estimasiAksi = jumlahKoin / COIN_SCALE;
  const totalApiCostIdr = costPerActionIdr * estimasiAksi;

  const rawHppIdeal =
    (totalApiCostIdr * config.globalMultiplier + config.adminFeeFixed) /
    (1 - config.mdrPercentage);

  return {
    estimasiModalApi:       Math.ceil(totalApiCostIdr),
    hppIdeal:               Math.ceil(rawHppIdeal),
    estimasiAksi:           Math.floor(estimasiAksi),
    estimasiTokenPerAksi:   totalEstimatedTokens,
    costPerActionUsd:       costPerActionUsd,
    modelLlm:   selectedLlm  ? { id: selectedLlm.id,   nama: selectedLlm.namaRouter }  : null,
    modelImage: selectedImage ? { id: selectedImage.id, nama: selectedImage.namaRouter } : null,
  };
};


const getAllPackages = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [total, packages] = await Promise.all([
    prisma.subscriptionPackage.count({ where: { status: "AKTIF" } }),
    prisma.subscriptionPackage.findMany({
      where: { status: "AKTIF" },
      orderBy: { hargaNominal: "asc" },
      skip,
      take: limit,
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

module.exports = {
  calculateLiveHPP,
  getAllPackages,
  createNewPackage,
  updatePackageById,
  deletePackageById,
};
