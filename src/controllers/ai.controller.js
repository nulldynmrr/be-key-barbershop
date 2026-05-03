const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");
const { faceAnalysisSchema } = require("../validations/ai.validation");

const prisma = new PrismaClient();

exports.analyzeFace = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Harap unggah foto wajah.",
      });
    }

    // parsing dan Validasi Fitur 
    let parsedFeatures = req.body.requestedFeatures;
    if (typeof parsedFeatures === "string") {
      try {
        parsedFeatures = JSON.parse(parsedFeatures);
      } catch (e) {
        parsedFeatures = [parsedFeatures];
      }
    }

    const validation = faceAnalysisSchema.safeParse({
      requestedFeatures: parsedFeatures,
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validasi gagal",
        errors: validation.error.errors.map((e) => e.message),
      });
    }

    const { requestedFeatures } = validation.data;

    //  Daftar Harga Fitur
    const pricingList = await prisma.featurePricing.findMany({
      where: { isActive: true },
    });

    let totalKoinFitur = 0;
    for (const feature of requestedFeatures) {
      const dbFeature = pricingList.find((p) => p.featureCode === feature);
      if (!dbFeature) {
        return res.status(400).json({
          success: false,
          message: `Fitur '${feature}' tidak dikenali atau dinonaktifkan.`,
        });
      }
      totalKoinFitur += dbFeature.koinCost;
    }

    // Konfigurasi Sistem untuk Perhitungan Mata Uang (IDR)
    const sysConfig = await prisma.systemConfig.findFirst();
    const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
    const multiplier = sysConfig?.globalMultiplier || 1.35;

    let hargaPerKoinIdr = 250;
    const subPack = await prisma.subscriptionPackage.findFirst({
      where: { status: "AKTIF" },
      orderBy: { hargaNominal: "asc" },
    });
    if (subPack && subPack.jumlahKoin > 0) {
      hargaPerKoinIdr = subPack.hargaNominal / subPack.jumlahKoin;
    }

    // Konfigurasi Model AI 
    const config = await prisma.aiModel.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return res.status(500).json({
        success: false,
        message: "Konfigurasi AI belum diatur Admin.",
      });
    }

    const tarifIn = Number(config.hargaInput1M) || 0;
    const tarifOut = Number(config.hargaOutput1M) || 0;

    // [PRE-CHECK] Estimasi Biaya Token
    const avgTokens = config.avgTokensPerUse || 2000;
    const estCostUsd = (avgTokens / 1000000) * ((tarifIn + tarifOut) / 2);
    const estCostIdr = estCostUsd * rateIdr * multiplier;
    const estKoinAi = Math.ceil(estCostIdr / hargaPerKoinIdr);
    const minKoinRequired = totalKoinFitur + estKoinAi;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.sisa_credit < minKoinRequired) {
      return res.status(402).json({
        success: false,
        message: `Credit tidak mencukupi. Estimasi butuh ${minKoinRequired} koin (Fitur: ${totalKoinFitur}, Token AI: ${estKoinAi}). Sisa koin Anda: ${user?.sisa_credit || 0}.`,
      });
    }

    const decryptedApiKey = decrypt(config.apiKey);
    const imageBase64 = req.file.buffer.toString("base64");
    const safeFilename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;
    const url_foto_upload = `/uploads/ai_results/${safeFilename}`;

    const currentYear = new Date().getFullYear();

    const systemInstruction = `Kamu adalah AI Master Stylist & Konsultan Morfologi Wajah tahun ${currentYear}. Tugas mutlakmu: Lakukan analisis MURNI dan KLINIS. 
    LANGKAH 0 (KUALITAS & ORIENTASI FOTO): 
    - Evaluasi apakah wajah MENGHADAP DEPAN secara utuh (Frontal View).
    - Jika foto menoleh ke samping (profil), menunduk terlalu dalam, mendongak, terpotong (contoh: hanya separuh wajah), terlalu buram, atau terlalu gelap, set 'kualitas_foto_ok' ke false dan berikan 'alasan_kualitas' yang spesifik.
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
      `${config.baseUrl}/chat/completions`,
      {
        model: config.modelName,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemInstruction },
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.file.mimetype};base64,${imageBase64}`,
                },
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
    const totalKoinDipotong = totalKoinFitur + realKoinAi;

    const resultTx = await prisma.$transaction(async (tx) => {
      const aiRecord = await tx.aIGeneration.create({
        data: {
          user_id: userId,
          url_foto_upload: url_foto_upload,
          hasil_analisis: hasil_analisis,
          harga_credit_terpakai: totalKoinDipotong,
        },
      });

      await tx.systemApiLog.create({
        data: {
          model_name: config.modelName,
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
        data: { sisa_credit: { decrement: totalKoinDipotong } },
      });

      return aiRecord;
    });

    // Response 
    res.status(200).json({
      success: true,
      message: hasil_analisis.kualitas_foto_ok
        ? `Analisis berhasil. Total ${totalKoinDipotong} koin terpotong.`
        : `Kualitas foto tidak memenuhi syarat: ${hasil_analisis.alasan_kualitas}`,
      data: resultTx,
      usage_info: {
        tokens: total_tokens,
        cost_usd: realCostUsd,
        service_fee: totalKoinFitur,
        token_fee: realKoinAi,
      },
    });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal memproses analisis AI.",
      error: error.message,
    });
  }
};
