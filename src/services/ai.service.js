const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");
const cache = require("../utils/memoryCache");

const prisma = new PrismaClient();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // Limit 5MB untuk mencegah Memory Leak

exports.processFaceAnalysis = async (userId, file, requestedFeatures) => {
  // PROTEKSI MEMORY LEAK
  if (file.size > MAX_FILE_SIZE) {
    const err = new Error(
      "Payload Terlalu Besar: Maksimal ukuran gambar adalah 5MB.",
    );
    err.statusCode = 413;
    throw err;
  }

  // [CACHING] Ambil Config Sistem & Pricing
  let sysConfig = cache.get("sysConfig");
  let pricingList = cache.get("pricingList");
  let configAi = cache.get("configAi");
  let subPack = cache.get("subPack");

  if (!sysConfig || !pricingList || !configAi || !subPack) {
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

  if (!configAi) {
    const err = new Error("Konfigurasi AI belum diatur Admin.");
    err.statusCode = 500;
    throw err;
  }

  // Kalkulasi Biaya Fitur
  let totalKoinFitur = 0;
  for (const feature of requestedFeatures) {
    const dbFeature = pricingList.find((p) => p.featureCode === feature);
    if (!dbFeature) {
      const err = new Error(
        `Fitur '${feature}' tidak dikenali atau dinonaktifkan.`,
      );
      err.statusCode = 400;
      throw err;
    }
    totalKoinFitur += dbFeature.koinCost;
  }

  const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
  const multiplier = sysConfig?.globalMultiplier || 1.35;
  const hargaPerKoinIdr =
    subPack && subPack.jumlahKoin > 0
      ? subPack.hargaNominal / subPack.jumlahKoin
      : 250;

  // [PRE-CHECK] ESTIMASI
  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;
  const avgTokens = configAi.avgTokensPerUse || 2000;
  const estCostUsd = (avgTokens / 1000000) * ((tarifIn + tarifOut) / 2);
  const estCostIdr = estCostUsd * rateIdr * multiplier;
  const estKoinAi = Math.ceil(estCostIdr / hargaPerKoinIdr);
  const minKoinRequired = totalKoinFitur + estKoinAi;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.sisa_credit < minKoinRequired) {
    const err = new Error(
      `Credit tidak mencukupi. Estimasi butuh ${minKoinRequired} koin (Fitur: ${totalKoinFitur}, Token AI: ${estKoinAi}). Sisa koin Anda: ${user?.sisa_credit || 0}.`,
    );
    err.statusCode = 402;
    throw err;
  }

  // INSTRUKSI DINAMIS & EKSEKUSI API
  const currentYear = new Date().getFullYear();
  const decryptedApiKey = decrypt(configAi.apiKey);
  const imageBase64 = file.buffer.toString("base64");
  const url_foto_upload = `/uploads/ai_results/${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;

  const systemInstruction = `Kamu adalah AI Master Stylist & Konsultan Morfologi Wajah tahun ${currentYear}. Tugas mutlakmu: Lakukan analisis MURNI dan KLINIS. 
  LANGKAH 0 (KUALITAS & ORIENTASI FOTO): 
  - Evaluasi apakah wajah MENGHADAP DEPAN secara utuh (Frontal View).
  - Jika foto menoleh ke samping (profil), menunduk terlalu dalam, mendongak, terpotong, terlalu buram, atau terlalu gelap, set 'kualitas_foto_ok' ke false dan berikan 'alasan_kualitas' yang spesifik.
  - PENTING: Jangan pernah mengubah atau menyarankan perubahan pada identitas wajah, warna kulit, bentuk mata, hidung, atau mulut subjek asli. Fokus hanya pada rambut.
  PERTAMA, hitung jumlah wajah dalam gambar ('jumlah_wajah').
  KEDUA, periksa kondisi kepala (Botak/Tertutup/Normal).
  KETIGA, identifikasi gender utama ('gender': Pria/Wanita).
  KEEMPAT, berikan 5 rekomendasi gaya rambut tren ${currentYear} yang menyeimbangkan proporsi wajah secara ilmiah.
  Kembalikan output dalam format JSON murni.`;

  const promptText = `Lakukan "Face Scan & Haircut Analysis" mendalam pada gambar ini. 
  0. Evaluasi 'kualitas_foto_ok' (Wajib Menghadap Depan). Jika tidak pas, berikan alasan di 'alasan_kualitas'.
  1. Hitung 'jumlah_wajah'. 
  2. Tentukan 'status_rambut' (Normal/Botak/Tertutup).
  3. Jika wajah terdeteksi utuh dan menghadap depan, tentukan 'gender' (Pria/Wanita), bentuk wajah, lebar dahi, jenis rambut, dan struktur tulang wajah. 
  4. Berikan 5 rekomendasi gaya rambut tren ${currentYear} yang paling cocok secara morfologi.`;

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

  // POST-CHECK & DATABASE TRANSACTION
  const {
    prompt_tokens = 0,
    completion_tokens = 0,
    total_tokens = 0,
  } = maiaResponse.data.usage || {};
  const realCostUsd =
    (prompt_tokens / 1000000) * tarifIn +
    (completion_tokens / 1000000) * tarifOut;
  const realCostIdr = realCostUsd * rateIdr * multiplier;
  const realKoinAi = Math.ceil(realCostIdr / hargaPerKoinIdr);
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
