const axios = require("axios");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { decrypt, encrypt } = require("../utils/encryption");
const cache = require("../utils/memoryCache");

const prisma = new PrismaClient();

exports.getExchangeSetting = async (req, res, next) => {
  try {
    let config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          id: 1,
          globalMultiplier: 1.35,
          baseRateUsdIdr: 17332,
          inflationBuffer: 0.05,
          adminFeeFixed: 4500.0,
          mdrPercentage: 0.007,
        },
      });
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

exports.updateExchangeSetting = async (req, res, next) => {
  try {
    const { globalMultiplier, baseRateUsdIdr, inflationBuffer } = req.body;
    const config = await prisma.systemConfig.upsert({
      where: { id: 1 },
      update: { globalMultiplier, baseRateUsdIdr, inflationBuffer },
      create: { id: 1, globalMultiplier, baseRateUsdIdr, inflationBuffer },
    });
    res.status(200).json({
      success: true,
      message: "Master Exchange berhasil disimpan",
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAiModels = async (req, res, next) => {
  try {
    const models = await prisma.aiModel.findMany({ orderBy: { namaRouter: "asc" } });
    const maskedModels = models.map((m) => ({
      ...m,
      apiKey: "********" + m.apiKey.substring(m.apiKey.length - 4),
    }));
    res.status(200).json({ success: true, data: maskedModels });
  } catch (error) {
    next(error);
  }
};

// Mengembalikan model aktif dikelompokkan per tipe — digunakan FE saat pembuatan paket
exports.getActiveModelsByType = async (req, res, next) => {
  try {
    const [llmModels, imageModels] = await Promise.all([
      prisma.aiModel.findMany({
        where: { typeAi: "LLM", isActive: true },
        select: { id: true, namaRouter: true, modelName: true, hargaInput1M: true, hargaOutput1M: true, avgTokensPerUse: true },
        orderBy: { namaRouter: "asc" },
      }),
      prisma.aiModel.findMany({
        where: { typeAi: "IMAGE_GEN", isActive: true },
        select: { id: true, namaRouter: true, modelName: true, hargaInput1M: true, hargaPerImage: true, avgTokensPerUse: true },
        orderBy: { namaRouter: "asc" },
      }),
    ]);
    res.status(200).json({ success: true, data: { llm: llmModels, image_gen: imageModels } });
  } catch (error) {
    next(error);
  }
};


exports.saveAiModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      namaRouter, baseUrl, modelName, apiKey,
      typeAi, pricingUnit,
      hargaInput1M, hargaOutput1M, hargaPerImage,
      maxBudget, rpmLimit, isActive,
    } = req.body;

    // Normalkan unit harga:
    // IMAGE_GEN: input tetap per /1M token, output flat per /image
    // LLM: input & output per /1M token, hargaPerImage tidak berlaku
    const resolvedUnit = typeAi === "IMAGE_GEN" ? "IMAGE" : "TOKEN";

    const modelData = {
      namaRouter, baseUrl, modelName,
      typeAi, pricingUnit: resolvedUnit,
      hargaInput1M:  Number(hargaInput1M)  || 0, // selalu berlaku untuk semua tipe
      hargaOutput1M: resolvedUnit === "TOKEN" ? Number(hargaOutput1M) || 0 : 0,
      hargaPerImage: resolvedUnit === "IMAGE" ? Number(hargaPerImage) || 0 : 0,
      maxBudget, rpmLimit, isActive,
    };

    let modelConfig;
    if (id) {
      if (apiKey && !apiKey.includes("***")) modelData.apiKey = encrypt(apiKey);
      modelConfig = await prisma.aiModel.update({ where: { id }, data: modelData });
    } else {
      if (!apiKey)
        return res.status(400).json({ success: false, message: "API Key wajib diisi untuk model baru!" });
      modelData.apiKey = encrypt(apiKey);
      modelConfig = await prisma.aiModel.create({ data: modelData });
    }

    res.status(200).json({ success: true, message: "Konfigurasi Model AI berhasil disimpan", data: modelConfig });
  } catch (error) {
    next(error);
  }
};

exports.deleteAiModel = async (req, res, next) => {
  try {
    await prisma.aiModel.delete({ where: { id: req.params.id } });
    res
      .status(200)
      .json({ success: true, message: "Model AI berhasil dihapus" });
  } catch (error) {
    next(error);
  }
};

exports.toggleModelStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    await prisma.aiModel.update({
      where: { id: req.params.id },
      data: { isActive },
    });
    res.status(200).json({
      success: true,
      message: `Router berhasil di-${isActive ? "aktifkan" : "matikan"}`,
    });
  } catch (error) {
    next(error);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    let { baseUrl, apiKey, id } = req.body;
    if (!baseUrl)
      return res
        .status(400)
        .json({ success: false, message: "Base URL wajib diisi" });

    if (apiKey && apiKey.includes("***") && id) {
      const existingModel = await prisma.aiModel.findUnique({ where: { id } });
      if (!existingModel)
        return res
          .status(404)
          .json({ success: false, message: "Model tidak ditemukan" });
      apiKey = decrypt(existingModel.apiKey);
    }

    if (!apiKey || apiKey.includes("***")) {
      return res
        .status(400)
        .json({ success: false, message: "API Key tidak valid untuk ditest" });
    }

    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok)
      throw new Error(`Koneksi Gagal: Error ${response.status}`);
    res
      .status(200)
      .json({ success: true, message: "Koneksi API Berhasil! Sistem siap." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAiUsageLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, logs, config] = await Promise.all([
      prisma.systemApiLog.count(),
      prisma.systemApiLog.findMany({
        skip,
        take: limit,
        orderBy: { tgl_penggunaan: "desc" },
        include: { user: { select: { email: true } } },
      }),
      prisma.systemConfig.findUnique({ where: { id: 1 } }),
    ]);

    const rateIdr = config?.baseRateUsdIdr || 16000;
    const formattedLogs = logs.map((log) => {
      const modalUsd = Number(log.cost_usd);
      const modalIdr = modalUsd * rateIdr;

      return {
        id: log.id,
        timestamp: log.tgl_penggunaan,
        email_user: log.user?.email || "Unknown",
        model: log.model_name,
        tokens_in_out: `${log.input_tokens} / ${log.output_tokens}`,
        total_tokens: log.total_tokens,

        // MODAL (cost admin ke provider AI)
        modal_api_usd: `$${modalUsd.toFixed(6)}`,
        modal_api_idr: `Rp ${Math.ceil(modalIdr).toLocaleString("id-ID")}`,

        // CHARGE (koin yang dipotong dari user)
        koin_charged: log.koin_charged,
        service_fee_koin: log.service_fee_koin,
        token_fee_koin: log.token_fee_koin,

        // FITUR YANG DIPAKAI
        features_used: log.features_used ? JSON.parse(log.features_used) : [],
      };
    });

    res.status(200).json({
      success: true,
      data: formattedLogs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getFeaturePricing = async (req, res) => {
  try {
    const pricing = await prisma.featurePricing.findMany({ orderBy: { featureCode: "asc" } });
    res.status(200).json({ success: true, data: pricing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeatureToggleMap = async (req, res, next) => {
  try {
    const pricing = await prisma.featurePricing.findMany({ orderBy: { featureCode: "asc" } });
    const result = {};
    for (const fp of pricing) {
      result[fp.featureCode] = {
        id: fp.id,
        namaFitur: fp.namaFitur,
        isActive: fp.isActive,
        koinCost: fp.koinCost,
      };
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateFeaturePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { koinCost, isActive } = req.body;

    const updatedPricing = await prisma.featurePricing.update({
      where: { id },
      data: { koinCost, isActive },
    });

    cache.delete("pricingList");

    res.status(200).json({
      success: true,
      message: "Harga fitur berhasil diperbarui",
      data: updatedPricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.calculateIdealKoin = async (req, res, next) => {
  try {
    const {
      featFaceHeatmap,
      featSymmetry,
      featAdvMapping,
      featHairAnalysis,
      featRiskAnalysis,
      featBarberInstructions,
      featVirtualTryOn,
      featHistory,
      featTrendAnalysis,
      llmModelId,
      imageModelId,
    } = req.body;

    const [config, pricingList] = await Promise.all([
      prisma.systemConfig.findFirst(),
      prisma.featurePricing.findMany({ where: { isActive: true } }),
    ]);

    let llmModel = null;
    if (llmModelId) {
      llmModel = await prisma.aiModel.findFirst({ where: { id: llmModelId, typeAi: "LLM" } });
    }
    if (!llmModel) {
      llmModel = await prisma.aiModel.findFirst({ where: { typeAi: "LLM", isActive: true }, orderBy: { hargaInput1M: "asc" } });
    }

    let imageModel = null;
    if (featVirtualTryOn) {
      if (imageModelId) {
        imageModel = await prisma.aiModel.findFirst({ where: { id: imageModelId, typeAi: "IMAGE_GEN" } });
      }
      if (!imageModel) {
        imageModel = await prisma.aiModel.findFirst({ where: { typeAi: "IMAGE_GEN", isActive: true } });
      }
    }

    if (!config || !llmModel) {
      return res.status(500).json({ success: false, message: "Konfigurasi sistem / model AI belum lengkap." });
    }

    const rateIdr    = config.baseRateUsdIdr * (1 + config.inflationBuffer);
    const multiplier = config.globalMultiplier || 1.35;
    const adminFee   = config.adminFeeFixed    || 4500;
    const mdr        = config.mdrPercentage    || 0.007;

    const activeModel = featVirtualTryOn && imageModel ? imageModel : llmModel;

    // Estimasi harga rata-rata per token USD berdasarkan model yang dipakai
    let avgTokenCostUsd = 0;
    if (activeModel.pricingUnit === "IMAGE") {
      avgTokenCostUsd = (Number(activeModel.hargaInput1M) || 0) / 1_000_000;
    } else {
      avgTokenCostUsd = ((Number(activeModel.hargaInput1M) || 0) + (Number(activeModel.hargaOutput1M) || 0)) / 2 / 1_000_000;
    }

    // Hitung base token untuk fitur dasar
    let totalEstimatedTokens = activeModel.avgTokensPerUse || 2000;

    // Tambahkan estimasi ekstra token untuk setiap fitur lanjutan yang aktif
    if (featSymmetry)           totalEstimatedTokens += 300;
    if (featAdvMapping)         totalEstimatedTokens += 500;
    if (featHairAnalysis)       totalEstimatedTokens += 400;
    if (featRiskAnalysis)       totalEstimatedTokens += 250;
    if (featBarberInstructions) totalEstimatedTokens += 250;
    if (featFaceHeatmap)        totalEstimatedTokens += 300;
    if (featTrendAnalysis)      totalEstimatedTokens += 400;

    // Total HPP Modal API (USD)
    let modalApiUsd = totalEstimatedTokens * avgTokenCostUsd;

    // Tambah biaya generate gambar jika menggunakan model IMAGE
    if (activeModel.pricingUnit === "IMAGE") {
      modalApiUsd += (Number(activeModel.hargaPerImage) || 0);
    }

    let modalApiIdr = modalApiUsd * rateIdr;

    // Tambah biaya storage (database) jika History aktif
    if (featHistory) modalApiIdr += 50;

    const featureMap = {
      STANDARD_SCAN:        true,
      FACE_HEATMAP:         featFaceHeatmap,
      SYMMETRY:             featSymmetry,
      ADV_MAPPING:          featAdvMapping,
      HAIR_ANALYSIS:        featHairAnalysis,
      RISK_ANALYSIS:        featRiskAnalysis,
      BARBER_INSTRUCTIONS:  featBarberInstructions,
      VIRTUAL_TRY_ON:       featVirtualTryOn,
      HISTORY:              featHistory,
      TREND_ANALYSIS:       featTrendAnalysis,
    };

    let totalKoinFitur = 0;
    for (const [code, aktif] of Object.entries(featureMap)) {
      if (!aktif) continue;
      const fp = pricingList.find((p) => p.featureCode === code);
      let costFitur = 0;
      if (fp && fp.koinCost > 0) {
        costFitur = fp.koinCost;
      } else if (code !== "STANDARD_SCAN") {
        // Enforce: setiap fitur ekstra yang aktif WAJIB menambah minimal 1 koin
        // agar sesuai keinginan admin bahwa harga harus naik jika ada fitur tambahan
        costFitur = 1;
      }
      totalKoinFitur += costFitur;
    }

    const hppPerGenerateIdr = (modalApiIdr * multiplier + adminFee) / (1 - mdr);
    const refHargaPerKoin   = 50;
    const koinApiIdr        = Math.ceil(modalApiIdr * multiplier / refHargaPerKoin);
    const totalKoinIdeal    = totalKoinFitur + koinApiIdr;

    res.status(200).json({
      success: true,
      data: {
        model_aktif:       activeModel.namaRouter,
        pricing_unit:      activeModel.pricingUnit,
        modal_api_usd:     `$${modalApiUsd.toFixed(6)}`,
        modal_api_idr:     Math.ceil(modalApiIdr),
        hpp_per_generate:  Math.ceil(hppPerGenerateIdr),
        koin_fitur:        totalKoinFitur,
        koin_api_estimate: koinApiIdr,
        total_koin_ideal:  totalKoinIdeal,
        fitur_aktif:       Object.entries(featureMap).filter(([, v]) => v).map(([k]) => k),
        catatan: "Koin ideal dihitung dengan asumsi harga referensi Rp 50/koin. Sesuaikan dengan harga paket aktual Anda.",
      },
    });
  } catch (error) {
    next(error);
  }
};


