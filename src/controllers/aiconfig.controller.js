const axios = require("axios");
const fs = require("fs");
const { decrypt, encrypt } = require("../utils/encryption");
const cache = require("../utils/memoryCache");

const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");
const { resolveBalanceUrl } = require("../services/ai/core/openAiUrl");

// Helper to fetch real balance from AI Provider (MAIA/OpenRouter)
const fetchModelBalance = async (model) => {
  try {
    if (!model.baseUrl || !model.apiKey) return null;
    
    const balanceUrl = resolveBalanceUrl(model.baseUrl);
    const apiKey = decrypt(model.apiKey);

    const response = await axios.get(balanceUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000 // 5s timeout
    });

    // MAIA/OpenRouter response usually: { data: { usage: 120, ... }, total_usage: 120 } or { credits: 120 }
    // Based on user screenshot, MAIA value is around 120.
    if (response.data) {
      return response.data.total_usage || response.data.credits || response.data.data?.usage || 0;
    }
    return 0;
  } catch (err) {
    console.error(`[Balance Fetch] Error for ${model.namaRouter}:`, err.message);
    return null;
  }
};

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
    return success(res, { data: config });
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
    return success(res, {
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
    
    // Hitung budget terpakai dari SystemApiLog per model_name
    const apiLogsAgg = await prisma.systemApiLog.groupBy({
      by: ['model_name'],
      _sum: { cost_usd: true },
    });

    const maskedModels = models.map((m) => {
      return {
        ...m,
        apiKey: "********" + m.apiKey.substring(m.apiKey.length - 4),
      };
    });

    // Fetch realtime balance for active models (parallel)
    const modelsWithBalance = await Promise.all(maskedModels.map(async (m) => {
      if (m.isActive && m.maxBudget > 0) {
        // Delta usage sejak admin terakhir sync saldo MAIA
        const deltaUsage = await prisma.systemApiLog.aggregate({
          _sum: { cost_usd: true },
          where: {
            model_name: m.modelName,
            tgl_penggunaan: m.last_sync_at ? { gte: m.last_sync_at } : undefined,
          },
        });

        const deltaUsed = Number(deltaUsage._sum.cost_usd || 0);

        // Anchor: saldo MAIA saat sync. Fallback ke maxBudget bila belum pernah sync.
        const baseBalance = m.last_maia_balance ?? m.maxBudget;
        const remainingBudget = Math.max(0, Number(baseBalance) - deltaUsed);
        const usedTotal = Number(m.maxBudget) - remainingBudget;
        const usedPercent = (usedTotal / Number(m.maxBudget)) * 100;

        // Fetch API real-time jika MAIA (opsional, tapi informatif di list)
        let realtimeBalance = null;
        if (m.namaRouter.toLowerCase().includes("maia")) {
           realtimeBalance = await fetchModelBalance(m);
        }

        return {
          ...m,
          usedBudget: usedTotal.toFixed(4),
          remainingBudget: remainingBudget.toFixed(4),
          usedPercent: usedPercent.toFixed(1),
          isWarning:  usedPercent >= 80,
          isCritical: usedPercent >= 95,
          lastSyncAt: m.last_sync_at,
          realtimeBalance,
          budgetSource: m.last_sync_at ? "maia_snapshot+db_delta" : "max_budget_only",
          budgetNote: m.last_sync_at
            ? `Saldo MAIA terakhir disync: ${m.last_sync_at.toISOString()}`
            : "⚠️ Belum pernah sync — pakai maxBudget sebagai baseline",
        };
      }
      return m;
    }));

    return success(res, { data: modelsWithBalance });
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
    return success(res, { data: { llm: llmModels, image_gen: imageModels } });
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
      maxBudget, rpmLimit, isActive, lastMaiaBalance,
    } = req.body;

    // Normalkan unit harga:
    // IMAGE_GEN: input tetap per /1M token, output flat per /image
    // LLM: input & output per /1M token, hargaPerImage tidak berlaku
    const resolvedUnit = typeAi === "IMAGE_GEN" ? "IMAGE" : "TOKEN";

    const modelData = {
      namaRouter, baseUrl, modelName,
      typeAi, pricingUnit: resolvedUnit,
      hargaInput1M: Number(hargaInput1M) || 0,
      hargaOutput1M: resolvedUnit === "TOKEN" ? Number(hargaOutput1M) || 0 : 0,
      hargaPerImage: resolvedUnit === "IMAGE" ? Number(hargaPerImage) || 0 : 0,
      maxBudget: parseFloat(maxBudget) || 0,
      rpmLimit: parseInt(rpmLimit) || 0,
      isActive,
    };

    if (lastMaiaBalance !== undefined) {
      modelData.last_maia_balance = lastMaiaBalance;
      modelData.last_sync_at = new Date();
    }

    let modelConfig;
    if (id) {
      if (apiKey && !apiKey.includes("***")) modelData.apiKey = encrypt(apiKey);
      modelConfig = await prisma.aiModel.update({ where: { id }, data: modelData });
    } else {
      if (!apiKey)
        return sendError(res, { message: "API Key wajib diisi untuk model baru!" });
      modelData.apiKey = encrypt(apiKey);
      modelConfig = await prisma.aiModel.create({ data: modelData });
    }

    return success(res, { message: "Konfigurasi Model AI berhasil disimpan", data: modelConfig });
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
    const modelId = req.params.id;
    
    await prisma.aiModel.update({
      where: { id: modelId },
      data: { isActive },
    });

    if (!isActive) {
      // Logic manual nonaktifkan paket dihapus agar status bersifat cerdas/dinamis
    }
    return success(res, {
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

    const { normalizeOpenAiBaseUrl } = require("../services/ai/core/openAiUrl");
    const normalizedRoot = normalizeOpenAiBaseUrl(baseUrl);
    const testUrl = normalizedRoot ? `${normalizedRoot}/models` : `${baseUrl}/models`;

    const response = await fetch(testUrl, {
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

exports.parseCurl = async (req, res, next) => {
  try {
    const { curl } = req.body;
    if (!curl) return res.status(400).json({ success: false, message: "CURL string is required" });

    // 1. Extract URL (Better regex: look specifically for http/https and stop at quotes or spaces)
    const urlMatch = curl.match(/https?:\/\/[^\s'"]+/);
    let fullUrl = urlMatch ? urlMatch[0] : "";
    
    // Clean up trailing slashes or quotes if any
    fullUrl = fullUrl.replace(/['"]$/, "");

    // 2. Extract API Key (Bearer token) - handle more variations
    const authMatch = curl.match(/Bearer\s+([a-zA-Z0-9\-_.]+)/i);
    const apiKey = authMatch ? authMatch[1] : "";

    // 3. Extract JSON Data and Model Name
    // Look for "model": "..." or 'model': '...'
    const modelMatch = curl.match(/["']model["']\s*:\s*["']([^"']+)["']/);
    let modelName = modelMatch ? modelMatch[1] : "";

    // If still not found, try to parse data segment
    if (!modelName) {
      const dataMatch = curl.match(/--data(?:-raw)?\s+['"]({[^'"]+})['"]/);
      if (dataMatch) {
        try {
          const jsonData = JSON.parse(dataMatch[1]);
          modelName = jsonData.model || "";
        } catch (e) {}
      }
    }

    let typeAi = "CHAT";
    let pricingUnit = "TOKEN";

    // 4. Determine Type and Base URL
    let baseUrl = fullUrl;
    if (fullUrl.includes("/chat/completions")) {
      typeAi = "CHAT";
      pricingUnit = "TOKEN";
      baseUrl = fullUrl.replace("/chat/completions", "");
    } else if (fullUrl.includes("/images/generations")) {
      typeAi = "IMAGE_GENERATION";
      pricingUnit = "IMAGE";
      baseUrl = fullUrl.replace("/images/generations", "");
    } else if (fullUrl.includes("/images/edits")) {
      typeAi = "IMAGE_EDIT";
      pricingUnit = "IMAGE";
      baseUrl = fullUrl.replace("/images/edits", "");
    }

    // Standardize Base URL (ensure /v1 suffix if it was in the original URL)
    if (!baseUrl.endsWith("/v1") && fullUrl.includes("/v1/")) {
       const v1Index = fullUrl.indexOf("/v1");
       if (v1Index !== -1) {
         baseUrl = fullUrl.substring(0, v1Index + 3);
       }
    }

    // Fallback for namaRouter if modelName is empty
    const displayRouterName = modelName ? (modelName.split("/").pop() || modelName) : "New Model";

    return res.status(200).json({
      success: true,
      data: {
        namaRouter: displayRouterName,
        modelName: modelName,
        baseUrl: baseUrl,
        apiKey: apiKey,
        typeAi: typeAi,
        pricingUnit: pricingUnit
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: "Gagal memproses CURL: " + error.message });
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
        include: {
          user: {
            select: {
              email: true,
              active_package: { select: { namaPaket: true } },
            },
          },
        },
      }),
      prisma.systemConfig.findUnique({ where: { id: 1 } }),
    ]);

    const globalMultiplier = config?.globalMultiplier || 1.35;
    const formattedLogs = logs.map((log) => {
      const modalUsd = Number(log.cost_usd);
      
      // Use historical snapshot if available, otherwise fallback to dynamic calculation (for old data)
      const userStatus = log.membership_snapshot 
        ? log.membership_snapshot.toUpperCase()
        : (log.user?.active_package?.namaPaket ? log.user.active_package.namaPaket.toUpperCase() : "FREE");

      // For chargeUser: if snapshot exists (even if 0), use it. 
      // If snapshot is null (old data), calculate dynamically.
      const chargeUsd = log.membership_snapshot !== null
        ? Number(log.charge_usd)
        : (modalUsd * globalMultiplier);

      const profitUsd = chargeUsd - modalUsd;

      return {
        id: log.id,
        createdAt: log.tgl_penggunaan,
        userEmail: log.user?.email || "Guest",
        userStatus: userStatus,
        promptTokens: log.input_tokens,
        completionTokens: log.output_tokens,
        modalApi: modalUsd.toFixed(5),
        chargeUser: chargeUsd.toFixed(5),
        profit: profitUsd.toFixed(5),
      };
    });

    return success(res, {
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
    return success(res, { data: pricing });
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
    return success(res, { data: result });
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

    return success(res, {
      message: "Harga fitur berhasil diperbarui",
      data: updatedPricing,
    });
  } catch (error) {
    return sendError(res, { message: error.message });
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

    const [config, llmModel, imageModel, pricingList] = await Promise.all([
      prisma.systemConfig.findFirst(),
      llmModelId
        ? prisma.aiModel.findUnique({ where: { id: llmModelId } })
        : prisma.aiModel.findFirst({ where: { typeAi: "LLM", isActive: true }, orderBy: { hargaInput1M: "asc" } }),
      imageModelId
        ? prisma.aiModel.findUnique({ where: { id: imageModelId } })
        : prisma.aiModel.findFirst({ where: { typeAi: "IMAGE_GEN", isActive: true } }),
      prisma.featurePricing.findMany({ where: { isActive: true } }),
    ]);

    if (!config || !llmModel) {
      return res.status(500).json({ success: false, message: "Konfigurasi sistem / model AI belum lengkap." });
    }

    const rateIdr = config.baseRateUsdIdr * (1 + config.inflationBuffer);
    const multiplier = config.globalMultiplier || 1.35;
    const adminFee = config.adminFeeFixed || 4500;
    const mdr = config.mdrPercentage || 0.007;

    const activeModel = featVirtualTryOn && imageModel ? imageModel : llmModel;

    // === 1. HITUNG COST LLM (Selalu Dihitung) ===
    let llmAvgTokenCostUsd = ((Number(llmModel.hargaInput1M) || 0) + (Number(llmModel.hargaOutput1M) || 0)) / 2 / 1_000_000;
    let totalEstimatedTokens = llmModel.avgTokensPerUse || 2000;

    // Estimasi token tambahan untuk LLM
    if (featSymmetry) totalEstimatedTokens += 300;
    if (featAdvMapping) totalEstimatedTokens += 500;
    if (featHairAnalysis) totalEstimatedTokens += 400;
    if (featRiskAnalysis) totalEstimatedTokens += 250;
    if (featBarberInstructions) totalEstimatedTokens += 250;
    if (featFaceHeatmap) totalEstimatedTokens += 300;
    if (featTrendAnalysis) totalEstimatedTokens += 400;

    let modalApiUsd = totalEstimatedTokens * llmAvgTokenCostUsd;

    // === 2. HITUNG COST IMAGE GEN (Jika Aktif) ===
    if (featVirtualTryOn && imageModel) {
      modalApiUsd += (Number(imageModel.hargaPerImage) || 0);
      
      // Jika Image Gen menggunakan token untuk input prompt
      let imageTokenCost = (Number(imageModel.hargaInput1M) || 0) / 1_000_000;
      let imageTokens = imageModel.avgTokensPerUse || 0;
      modalApiUsd += (imageTokens * imageTokenCost);
    }

    let modalApiIdr = modalApiUsd * rateIdr;

    // Tambah biaya storage (database) jika History aktif
    if (featHistory) modalApiIdr += 50;

    const featureMap = {
      STANDARD_SCAN: true,
      FACE_HEATMAP: featFaceHeatmap,
      SYMMETRY: featSymmetry,
      ADV_MAPPING: featAdvMapping,
      HAIR_ANALYSIS: featHairAnalysis,
      RISK_ANALYSIS: featRiskAnalysis,
      BARBER_INSTRUCTIONS: featBarberInstructions,
      VIRTUAL_TRY_ON: featVirtualTryOn,
      HISTORY: featHistory,
      TREND_ANALYSIS: featTrendAnalysis,
    };

    let totalKoinFitur = 0;
    for (const [code, aktif] of Object.entries(featureMap)) {
      if (!aktif) continue;
      const fp = pricingList.find((p) => p.featureCode === code);
      if (fp) totalKoinFitur += fp.koinCost;
    }

    const hppPerGenerateIdr = (modalApiIdr * multiplier + adminFee) / (1 - mdr);
    const refHargaPerKoin = 50;
    const koinApiIdr = Math.ceil(modalApiIdr * multiplier / refHargaPerKoin);
    const totalKoinIdeal = totalKoinFitur + koinApiIdr;

    return success(res, {
      data: {
        model_aktif: activeModel.namaRouter,
        pricing_unit: activeModel.pricingUnit,
        modal_api_usd: `$${modalApiUsd.toFixed(6)}`,
        modal_api_idr: Math.ceil(modalApiIdr),
        hpp_per_generate: Math.ceil(hppPerGenerateIdr),
        koin_fitur: totalKoinFitur,
        koin_api_estimate: koinApiIdr,
        total_koin_ideal: totalKoinIdeal,
        fitur_aktif: Object.entries(featureMap).filter(([, v]) => v).map(([k]) => k),
        catatan: "Koin ideal dihitung dengan asumsi harga referensi Rp 50/koin. Sesuaikan dengan harga paket aktual Anda.",
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAiModelBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const model = await prisma.aiModel.findUnique({ where: { id } });
    if (!model) return sendError(res, { message: "Model tidak ditemukan" });

    const balance = await fetchModelBalance(model);
    return success(res, { data: { balance } });
  } catch (error) {
    next(error);
  }
};

exports.syncModelBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const model = await prisma.aiModel.findUnique({ where: { id } });
    if (!model) return sendError(res, { message: "Model tidak ditemukan" });

    const balance = await fetchModelBalance(model);
    if (balance === null) return sendError(res, { message: "Gagal mengambil saldo dari provider" });

    const updated = await prisma.aiModel.update({
      where: { id },
      data: { last_maia_balance: balance, last_sync_at: new Date() }
    });

    return success(res, { 
      message: `Sinkronisasi Berhasil! Max Budget ${model.namaRouter} disesuaikan ke $${balance}`,
      data: updated 
    });
  } catch (error) {
    next(error);
  }
};


