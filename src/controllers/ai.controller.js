const axios = require("axios");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");

const prisma = new PrismaClient();

exports.analyzeFace = async (req, res) => {
  try {
    const userId = req.user.id;

    // Cek sisa credit user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.sisa_credit < 1) {
      return res
        .status(403)
        .json({ success: false, message: "Credit tidak mencukupi." });
    }

    // Validasi file upload
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Harap unggah foto wajah." });
    }

    // Ambil config AI yang aktif
    const config = await prisma.aiModelConfig.findFirst({
      where: { tipe_ai: "face-analysis", is_active: true },
    });

    if (!config) {
      return res.status(500).json({
        success: false,
        message: "Konfigurasi AI belum diatur Admin.",
      });
    }

    // Buka gembok API Key
    const decryptedApiKey = decrypt(config.api_key);
    const imageBase64 = req.file.buffer.toString("base64");
    const url_foto_upload = `/uploads/ai_results/${req.file.filename}`;

    // Eksekusi API AI ke MAIA Router
    const maiaResponse = await axios.post(
      `${config.base_url}/chat/completions`,
      {
        model: config.model_name,
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

    // Parsing hasil analisis
    const hasil_analisis = JSON.parse(
      maiaResponse.data.choices[0].message.content,
    );

    // Ambil data usage (token)
    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
    } = maiaResponse.data.usage || {};

    // Logika hitung biaya (Support token & image agar tidak 0)
    const tarifIn = Number(config.tarif_input_per_1k) || 0;
    const tarifOut = Number(config.tarif_output_per_1k) || 0;
    const tarifImg = Number(config.tarif_per_image) || 0; // Jika modelnya image gen

    // Rumus: (Token / 1000 * Harga) + (Jika ada image * Harga)
    const costTeks =
      (prompt_tokens / 1000) * tarifIn + (completion_tokens / 1000) * tarifOut;
    const costImg =
      (maiaResponse.data.images ? maiaResponse.data.images.length : 0) *
      tarifImg;
    const hitungCostUsd = costTeks + costImg;

    // Transaction: Save log, update credit, & simpan riwayat
    const resultTx = await prisma.$transaction(async (tx) => {
      const aiRecord = await tx.aIGeneration.create({
        data: {
          user_id: userId,
          url_foto_upload,
          hasil_analisis,
          harga_credit_terpakai: 1,
        },
      });

      await tx.systemApiLog.create({
        data: {
          model_name: config.model_name,
          input_tokens: prompt_tokens,
          output_tokens: completion_tokens,
          total_tokens: total_tokens,
          cost_usd: hitungCostUsd,
          user_id: userId,
          ai_generation_id: aiRecord.id,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { sisa_credit: { decrement: 1 } },
      });

      return aiRecord;
    });

    // Response ke Frontend
    res.status(200).json({
      success: true,
      message: "Analisis berhasil",
      data: resultTx,
      usage_info: { tokens: total_tokens, cost_usd: hitungCostUsd.toFixed(6) },
    });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal memproses AI.",
      error: error.message,
    });
  }
};
