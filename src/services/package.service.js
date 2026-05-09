const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const convertToDays = (value, unit) => {
  if (!value || !unit) return null;
  switch (unit.toUpperCase()) {
    case "BULAN":
      return value * 30;
    case "TAHUN":
      return value * 365;
    default:
      return value;
  }
};

const calculateLiveHPP = async (payload) => {
  const { jumlahKoin, featVirtualTryOn } = payload;

  const [config, baseModel] = await Promise.all([
    prisma.systemConfig.findFirst(),
    prisma.aiModel.findFirst({ orderBy: { hargaInput1M: "asc" } }),
  ]);

  if (!config || !baseModel) {
    throw new Error("Konfigurasi Sistem atau Model API belum disetting!");
  }

  const effectiveRate = config.baseRateUsdIdr * (1 + config.inflationBuffer);

  let modelToUse = baseModel;

  if (featVirtualTryOn) {
    const genModel = await prisma.aiModel.findFirst({
      where: { typeAi: "IMAGE_GEN" },
    });
    if (genModel) {
      modelToUse = genModel;
    }
  }

  const tarifIn = Number(modelToUse.hargaInput1M) || 0;
  const tarifOut = Number(modelToUse.hargaOutput1M) || 0;
  const avgTokens = modelToUse.avgTokensPerUse || 2000;

  const costPerActionUsd = (avgTokens / 1000000) * ((tarifIn + tarifOut) / 2);
  const costPerActionIdr = costPerActionUsd * effectiveRate;

  const COIN_SCALE = 10;
  const estimasiAksi = jumlahKoin / COIN_SCALE;

  const totalApiCostIdr = costPerActionIdr * estimasiAksi;
  const rawHppIdeal =
    (totalApiCostIdr * config.globalMultiplier + config.adminFeeFixed) /
    (1 - config.mdrPercentage);

  return {
    estimasiModalApi: Math.ceil(totalApiCostIdr),
    hppIdeal: Math.ceil(rawHppIdeal),
    estimasiAksi: Math.floor(estimasiAksi)
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
      if (pkg.durationDays % 365 === 0)
        durasi_display = `${pkg.durationDays / 365} Tahun`;
      else if (pkg.durationDays % 30 === 0)
        durasi_display = `${pkg.durationDays / 30} Bulan`;
      else durasi_display = `${pkg.durationDays} Hari`;
    }

    return {
      id: pkg.id,
      nama: pkg.namaPaket,
      tipe: pkg.typeValue,
      koin: pkg.jumlahKoin,
      durasi_text: durasi_display,
      harga_asli: pkg.hargaNominal,
      harga_bayar: isPromoValid ? pkg.hargaDiskon : pkg.hargaNominal,
      is_promo: !!isPromoValid,
      berakhir_pada: isPromoValid ? pkg.diskonAkhir : null,
    };
  });

  return {
    total,
    topup_koin: formattedPackages.filter((p) => p.tipe === "ONTIME"),
    langganan_premium: formattedPackages.filter(
      (p) => p.tipe === "SUBSCRIPTION",
    ),
  };
};

const createNewPackage = async (validatedData) => {
  const durationDays =
    validatedData.typeValue === "SUBSCRIPTION"
      ? convertToDays(validatedData.durasi_value, validatedData.durasi_unit)
      : null;

  return await prisma.subscriptionPackage.create({
    data: {
      namaPaket: validatedData.namaPaket,
      deskripsi: validatedData.deskripsi || "",
      typeValue: validatedData.typeValue,
      jumlahKoin: validatedData.jumlahKoin,
      durationDays,
      featStandardScan: validatedData.featStandardScan,
      featSymmetry: validatedData.featSymmetry,
      featAdvMapping: validatedData.featAdvMapping,
      featVirtualTryOn: validatedData.featVirtualTryOn,
      featHistory: validatedData.featHistory,
      hppIdeal: validatedData.hppIdeal,
      hargaNominal: validatedData.hargaNominal,
      promoAktif: validatedData.promoAktif,
      hargaDiskon: validatedData.promoAktif ? validatedData.hargaDiskon : null,
      diskonMulai:
        validatedData.promoAktif && validatedData.diskonMulai
          ? new Date(validatedData.diskonMulai)
          : null,
      diskonAkhir:
        validatedData.promoAktif && validatedData.diskonAkhir
          ? new Date(validatedData.diskonAkhir)
          : null,
      status: "AKTIF",
    },
  });
};

const updatePackageById = async (id, validatedData) => {
  const existingPackage = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });
  if (!existingPackage) {
    const error = new Error("Paket tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  let durationDays = existingPackage.durationDays;
  if (
    validatedData.typeValue === "SUBSCRIPTION" &&
    validatedData.durasi_value
  ) {
    durationDays = convertToDays(
      validatedData.durasi_value,
      validatedData.durasi_unit,
    );
  }

  const updateData = { ...validatedData };
  delete updateData.durasi_value;
  delete updateData.durasi_unit;

  if (updateData.diskonMulai)
    updateData.diskonMulai = new Date(updateData.diskonMulai);
  if (updateData.diskonAkhir)
    updateData.diskonAkhir = new Date(updateData.diskonAkhir);

  return await prisma.subscriptionPackage.update({
    where: { id },
    data: { ...updateData, durationDays },
  });
};

const deletePackageById = async (id) => {
  const existingPackage = await prisma.subscriptionPackage.findUnique({
    where: { id },
  });
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
