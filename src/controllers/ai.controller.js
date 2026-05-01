const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");
const { faceAnalysisSchema } = require("../validations/ai.validation");

const prisma = new PrismaClient();

exports.analyzeFace = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validasi file upload 
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Harap unggah foto wajah.",
      });
    }

    // Parse requestedFeatures
    let parsedFeatures = req.body.requestedFeatures;
    if (typeof parsedFeatures === "string") {
      try {
        parsedFeatures = JSON.parse(parsedFeatures);
      } catch (e) {
        parsedFeatures = [parsedFeatures];
      }
    }

    // Validasi Zod
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

    // Hitung harga dinamis dari DB
    const pricingList = await prisma.featurePricing.findMany({
      where: { isActive: true },
    });

    let totalKoinDipotong = 0;
    for (const feature of requestedFeatures) {
      const dbFeature = pricingList.find((p) => p.featureCode === feature);
      if (!dbFeature) {
        return res.status(400).json({
          success: false,
          message: `Fitur '${feature}' tidak dikenali atau sedang dinonaktifkan.`,
        });
      }
      totalKoinDipotong += dbFeature.koinCost;
    }

    // Cek saldo koin user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.sisa_credit < totalKoinDipotong) {
      return res.status(402).json({
        success: false,
        message: `Credit tidak mencukupi. Butuh ${totalKoinDipotong} koin, sisa: ${user?.sisa_credit ?? 0}. Silakan Top-Up.`,
      });
    }

    // Ambil konfigurasi AI aktif 
    const config = await prisma.aiModel.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return res.status(500).json({
        success: false,
        message: "Konfigurasi AI belum diatur oleh Admin.",
      });
    }

    // Simpan file ke disk
    const safeFilename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;
    const uploadDir = path.join(__dirname, "../public/uploads/ai_results");
    const filePath = path.join(uploadDir, safeFilename);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(filePath, req.file.buffer);

    const url_foto_upload = `/uploads/ai_results/${safeFilename}`;

    // Panggil AI API
    const decryptedApiKey = decrypt(config.apiKey);
    const imageBase64 = req.file.buffer.toString("base64");

    const maiaResponse = await axios.post(
      `${config.baseUrl}/chat/completions`,
      {
        model: config.modelName,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analisis morfologi wajah ini. Kembalikan HANYA format JSON.",
              },
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

    // Parse hasil analisis
    const hasil_analisis = JSON.parse(
      maiaResponse.data.choices[0].message.content,
    );

    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
    } = maiaResponse.data.usage || {};

    // Hitung cost USD (hargaInput1M & hargaOutput1M = harga per 1 juta token)
    const tarifIn = Number(config.hargaInput1M) || 0;
    const tarifOut = Number(config.hargaOutput1M) || 0;
    const costUsd =
      (prompt_tokens / 1_000_000) * tarifIn +
      (completion_tokens / 1_000_000) * tarifOut;

    // Transaksi atomik: simpan record + potong koin
    const resultTx = await prisma.$transaction(async (tx) => {
      const aiRecord = await tx.aIGeneration.create({
        data: {
          user_id: userId,
          url_foto_upload,
          hasil_analisis,
          harga_credit_terpakai: totalKoinDipotong,
        },
      });

      await tx.systemApiLog.create({
        data: {
          model_name: config.modelName,
          input_tokens: prompt_tokens,
          output_tokens: completion_tokens,
          total_tokens,
          cost_usd: costUsd,
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

    return res.status(200).json({
      success: true,
      message: `Analisis berhasil. ${totalKoinDipotong} koin terpotong.`,
      data: resultTx,
      usage_info: {
        tokens: total_tokens,
        cost_usd: costUsd.toFixed(6),
      },
    });
  } catch (error) {
    console.error("AI Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Gagal memproses AI.",
      error: error.message,
    });
  }
};
