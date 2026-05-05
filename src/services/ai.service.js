const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");
const cache = require("../utils/memoryChache");

const prisma = new PrismaClient();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // Limit 5MB

exports.processFaceAnalysis = async (userId, file, requestedFeatures) => {
  // PROTEKSI MEMORY LEAK
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Payload Terlalu Besar: Maksimal ukuran gambar adalah 5MB.",
    );
  }

  // [CACHING] Ambil Config Sistem & Pricing
  let sysConfig = cache.get("sysConfig");
  let pricingList = cache.get("pricingList");
  let configAi = cache.get("configAi");
  let subPack = cache.get("subPack");

  if (!sysConfig || !pricingList || !configAi) {
    [sysConfig, pricingList, configAi, subPack] = await Promise.all([
      prisma.systemConfig.findFirst(),
      prisma.featurePricing.findMany({ where: { isActive: true } }),
      prisma.aiModel.findFirst({ where: { isActive: true } }),
      prisma.subscriptionPackage.findFirst({
        where: { status: "AKTIF" },
        orderBy: { hargaNominal: "asc" },
      }),
    ]);

    cache.set("sysConfig", sysConfig, 300);
    cache.set("pricingList", pricingList, 300);
    cache.set("configAi", configAi, 300);
    cache.set("subPack", subPack, 300);
  }

  if (!configAi) throw new Error("Konfigurasi AI belum diatur Admin.");

  // Kalkulasi Biaya Fitur
  let totalKoinFitur = 0;
  for (const feature of requestedFeatures) {
    const dbFeature = pricingList.find((p) => p.featureCode === feature);
    if (!dbFeature) throw new Error(`Fitur '${feature}' tidak dikenali.`);
    totalKoinFitur += dbFeature.koinCost;
  }

  const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
  const multiplier = sysConfig?.globalMultiplier || 1.35;
  const hargaPerKoinIdr =
    subPack && subPack.jumlahKoin > 0
      ? subPack.hargaNominal / subPack.jumlahKoin
      : 250;

  // PRE-CHECK ESTIMASI
  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;
  const avgTokens = configAi.avgTokensPerUse || 2000;
  const estCostIdr =
    (avgTokens / 1000000) * ((tarifIn + tarifOut) / 2) * rateIdr * multiplier;
  const estKoinAi = Math.ceil(estCostIdr / hargaPerKoinIdr);
  const minKoinRequired = totalKoinFitur + estKoinAi;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.sisa_credit < minKoinRequired) {
    const err = new Error(
      `Credit tidak cukup. Estimasi butuh ${minKoinRequired} koin.`,
    );
    err.statusCode = 402;
    throw err;
  }

  // EKSEKUSI API & SYSTEM INSTRUCTION
  const currentYear = new Date().getFullYear();
  const decryptedApiKey = decrypt(configAi.apiKey);
  const imageBase64 = file.buffer.toString("base64");
  const url_foto_upload = `/uploads/ai_results/${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;

  const systemInstruction = `Kamu adalah AI Master Stylist & Konsultan Morfologi Wajah tahun ${currentYear}. Lakukan analisis KLINIS. 
  WAJIB: Wajah harus menghadap depan (Frontal View). Jika tidak, set 'kualitas_foto_ok' ke false. 
  DILARANG mengubah identitas wajah, warna kulit, atau fitur wajah asli. Fokus hanya pada rekomendasi rambut.`;

  const promptText = `Lakukan Face Scan mendalam. Evaluasi 'kualitas_foto_ok', hitung 'jumlah_wajah', tentukan 'status_rambut', gender, bentuk wajah, dan 5 rekomendasi gaya rambut tren ${currentYear}.`;

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
            {
              type: "image_url",
              image_url: { url: `data:${file.mimetype};base64,${imageBase64}` },
            },
          ],
        },
      ],
    },
    { headers: { Authorization: `Bearer ${decryptedApiKey}` } },
  );

  const hasil_analisis = JSON.parse(
    maiaResponse.data.choices[0].message.content,
  );

  // POST-CHECK  & TRANSACTION
  const {
    prompt_tokens = 0,
    completion_tokens = 0,
    total_tokens = 0,
  } = maiaResponse.data.usage || {};
  const realCostUsd =
    (prompt_tokens / 1000000) * tarifIn +
    (completion_tokens / 1000000) * tarifOut;
  const realKoinAi = Math.ceil(
    (realCostUsd * rateIdr * multiplier) / hargaPerKoinIdr,
  );
  const totalDipotong = totalKoinFitur + realKoinAi;

  const resultTx = await prisma.$transaction(async (tx) => {
    const aiRecord = await tx.aIGeneration.create({
      data: {
        user_id: userId,
        url_foto_upload: url_foto_upload,
        hasil_analisis: hasil_analisis,
        harga_credit_terpakai: totalDipotong,
      },
    });

    await tx.systemApiLog.create({
      data: {
        model_name: configAi.modelName,
        input_tokens: prompt_tokens,
        output_tokens: completion_tokens,
        total_tokens: total_tokens,
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
