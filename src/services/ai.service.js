const axios = require("axios");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");
const cache = require("../utils/memoryCache");

const prisma = new PrismaClient();
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const FEATURE_GATE_MAP = {
  STANDARD_SCAN: "featStandardScan",
  SYMMETRY: "featSymmetry",
  ADV_MAPPING: "featAdvMapping",
  VIRTUAL_TRY_ON: "featVirtualTryOn",
  HISTORY: "featHistory",
  TREND_ANALYSIS: "featTrendAnalysis",
};

exports.processFaceAnalysis = async (userId, file, requestedFeatures) => {
  if (file.size > MAX_FILE_SIZE) {
    let quality = 80;
    let compressedBuffer = await sharp(file.buffer).webp({ quality }).toBuffer();

    while (compressedBuffer.length > MAX_FILE_SIZE && quality > 20) {
      quality -= 10;
      compressedBuffer = await sharp(file.buffer).webp({ quality }).toBuffer();
    }

    file.buffer = compressedBuffer;
    file.size = compressedBuffer.length;
    file.mimetype = "image/webp";
    file.originalname = file.originalname.replace(/\.[^.]+$/, ".webp");
  }

  const [user, sysConfigFromDb, pricingListFromDb, configAiFromDb] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { active_package: true } }),
    cache.get("sysConfig") ? null : prisma.systemConfig.findFirst(),
    cache.get("pricingList") ? null : prisma.featurePricing.findMany({ where: { isActive: true } }),
    cache.get("configAi") ? null : prisma.aiModel.findFirst({ where: { isActive: true } }),
  ]);

  const sysConfig = cache.get("sysConfig") || sysConfigFromDb;
  const pricingList = cache.get("pricingList") || pricingListFromDb;
  const configAi = cache.get("configAi") || configAiFromDb;

  if (sysConfigFromDb) cache.set("sysConfig", sysConfig, 300);
  if (pricingListFromDb) cache.set("pricingList", pricingList, 300);
  if (configAiFromDb) cache.set("configAi", configAi, 300);

  if (!configAi) {
    const err = new Error("Konfigurasi AI belum diatur Admin.");
    err.statusCode = 500;
    throw err;
  }

  if (!user || !user.active_package) {
    const err = new Error("Anda belum memiliki paket aktif. Silakan beli paket terlebih dahulu.");
    err.statusCode = 403;
    throw err;
  }

  const userPackage = user.active_package;

  for (const feature of requestedFeatures) {
    const col = FEATURE_GATE_MAP[feature.toUpperCase()];
    if (!col) {
      const err = new Error(`Fitur '${feature}' tidak dikenal.`);
      err.statusCode = 400;
      throw err;
    }
    if (!userPackage[col]) {
      const err = new Error(
        `Akses Ditolak: Fitur '${feature}' tidak termasuk dalam paket '${userPackage.namaPaket}' Anda.`
      );
      err.statusCode = 403;
      throw err;
    }
  }

  let totalKoinFitur = 0;
  for (const feature of requestedFeatures) {
    const dbFeature = pricingList.find((p) => p.featureCode === feature.toUpperCase());
    if (dbFeature) totalKoinFitur += dbFeature.koinCost;
  }

  const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
  const multiplier = sysConfig?.globalMultiplier || 1.35;

  const hargaPerKoinIdr = userPackage.jumlahKoin > 0
    ? userPackage.hargaNominal / userPackage.jumlahKoin
    : 250;

  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;
  const avgTokens = configAi.avgTokensPerUse || 2000;

  // IMAGE_GEN: input per /1M token + output flat per /image
  // LLM: input & output per /1M token
  const estCostUsd = configAi.pricingUnit === "IMAGE"
    ? (avgTokens / 1_000_000) * tarifIn + (Number(configAi.hargaPerImage) || 0)
    : (avgTokens / 1_000_000) * ((tarifIn + tarifOut) / 2);

  const estCostIdr = estCostUsd * rateIdr * multiplier;
  const estKoinAi = Math.ceil(estCostIdr / hargaPerKoinIdr);
  const minKoinRequired = totalKoinFitur + estKoinAi;

  if (user.sisa_credit < minKoinRequired) {
    const err = new Error(
      `Credit tidak mencukupi. Estimasi butuh ${minKoinRequired} koin (Fitur: ${totalKoinFitur}, Token AI: ${estKoinAi}). Sisa: ${user.sisa_credit}.`
    );
    err.statusCode = 402;
    throw err;
  }

  //[INTRUKSI]
  const currentYear = new Date().getFullYear();
  const decryptedApiKey = decrypt(configAi.apiKey);
  const imageBase64 = file.buffer.toString("base64");
  const url_foto_upload = `/uploads/ai_results/${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;

  const isTrendActive = requestedFeatures.some(f => f.toUpperCase() === "TREND_ANALYSIS");

  const trendInstruction = isTrendActive
    ? `FITUR PREMIUM AKTIF: Berikan 5 rekomendasi gaya rambut PALING TREN tahun ${currentYear}, MATCH dengan bentuk wajah terdeteksi.`
    : `Berikan 5 rekomendasi gaya rambut yang sesuai proporsi wajah. Rentang tren: ${currentYear - 5}–${currentYear}.`;

  const systemInstruction = `Kamu adalah AI Master Stylist & Konsultan Morfologi Wajah tahun ${currentYear}. Lakukan analisis MURNI dan KLINIS.
  LANGKAH 0: Evaluasi apakah wajah MENGHADAP DEPAN. Jika tidak, set 'kualitas_foto_ok' = false dan isi 'alasan_kualitas'.
  PENTING: Jangan ubah identitas wajah. Fokus hanya pada rambut.
  1. Hitung 'jumlah_wajah'. 2. Periksa 'status_rambut' (Botak/Tertutup/Normal). 3. Identifikasi 'gender'.
  4. ${trendInstruction}
  Output: format JSON murni.`;

  const promptText = `Lakukan "Face Scan & Haircut Analysis" pada gambar ini.
  0. Evaluasi 'kualitas_foto_ok'. Jika tidak pas, isi 'alasan_kualitas'.
  1. Hitung 'jumlah_wajah'. 2. 'status_rambut'. 3. 'gender', bentuk wajah, lebar dahi, jenis rambut, struktur tulang.
  4. ${trendInstruction}`;

  const maiaResponse = await axios.post(
    `${configAi.baseUrl}/chat/completions`,
    {
      model: configAi.modelName,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemInstruction },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${imageBase64}` } },
          ],
        },
      ],
    },
    { headers: { Authorization: `Bearer ${decryptedApiKey}` } }
  );

  const hasil_analisis = JSON.parse(maiaResponse.data.choices[0].message.content);

  const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = maiaResponse.data.usage || {};


  const realCostUsd = configAi.pricingUnit === "IMAGE"
    ? (prompt_tokens / 1_000_000) * tarifIn + (Number(configAi.hargaPerImage) || 0)
    : (prompt_tokens / 1_000_000) * tarifIn + (completion_tokens / 1_000_000) * tarifOut;
  const realCostIdr = realCostUsd * rateIdr * multiplier;
  const realKoinAi = Math.ceil(realCostIdr / hargaPerKoinIdr);
  const totalDipotong = totalKoinFitur + realKoinAi;

  const resultTx = await prisma.$transaction(async (tx) => {
    const aiRecord = await tx.aIGeneration.create({
      data: { user_id: userId, url_foto_upload, hasil_analisis, harga_credit_terpakai: totalDipotong },
    });

    await tx.systemApiLog.create({
      data: {
        model_name: configAi.modelName,
        input_tokens: prompt_tokens,
        output_tokens: completion_tokens,
        total_tokens,
        cost_usd: realCostUsd,
        user_id: userId,
        ai_generation_id: aiRecord.id,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { sisa_credit: { decrement: totalDipotong } },
    });

    return aiRecord;
  });

  return {
    kualitas_ok: hasil_analisis.kualitas_foto_ok,
    alasan: hasil_analisis.alasan_kualitas || null,
    totalDipotong,
    totalKoinFitur,
    realKoinAi,
    resultTx,
    total_tokens,
    realCostUsd,
  };
};
