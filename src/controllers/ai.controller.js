const { faceAnalysisSchema } = require("../validations/ai.validation");
const aiService = require("../services/ai");
const cache = require("../utils/memoryCache");

const prisma = require("../config/prisma");

const { FEATURE_GATE_MAP } = require("../services/ai/featureGateMap");

exports.analyzeFace = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Harap unggah foto wajah." });
    }

    let parsedFeatures = req.body.requestedFeatures;
    if (typeof parsedFeatures === "string") {
      try {
        parsedFeatures = JSON.parse(parsedFeatures);
      } catch (e) {
        parsedFeatures = [parsedFeatures];
      }
    }

    const validation = faceAnalysisSchema.safeParse({ requestedFeatures: parsedFeatures });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        errors: validation.error.errors.map((e) => e.message),
      });
    }

    const result = await aiService.processFaceAnalysis(
      req.user.id,
      req.file,
      validation.data.requestedFeatures
    );

    res.status(200).json({
      success: true,
      message: result.kualitas_ok
        ? `Analisis berhasil. Total ${result.totalDipotong} koin terpotong (Service: ${result.totalKoinFitur}, AI Token: ${result.realKoinAi}${result.imageGenKoin ? `, Image Gen: ${result.imageGenKoin}` : ''}).`
        : `Kualitas foto kurang baik: ${result.alasan}. Total ${result.totalDipotong} koin tetap terpotong.`,
      data: {
        record: result.resultTx || {
          url_foto_upload: result.url_foto_upload,
          url_hasil_img: result.url_hasil_img
        },
        hasil_analisis: result.hasil_analisis,
        active_features: result.activeFeatures,
      },
      usage_info: {
        tokens: result.total_tokens,
        cost_usd: result.realCostUsd,
        service_fee: result.totalKoinFitur,
        token_fee: result.realKoinAi,
        image_gen_fee: result.imageGenKoin || 0,
        credit_before: result.sisa_credit_before,
        credit_after: result.sisa_credit_after,
      },
    });
  } catch (error) {
    console.error("AI Controller Error:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      errorCode: error.errorCode || "GENERIC_ERROR",
      message: error.message || "Gagal memproses AI.",
    });
  }
};

exports.getAvailableFeatures = async (req, res) => {
  try {
    const userId = req.user?.id;
    const pricingList = await prisma.featurePricing.findMany({ orderBy: { featureCode: "asc" } });

    let userPackage = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { active_package: true },
      });
      userPackage = user?.active_package || null;
    }

    const features = {};
    for (const fp of pricingList) {
      const col = FEATURE_GATE_MAP[fp.featureCode];
      const globallyActive = fp.isActive;
      const inPackage = userPackage ? !!userPackage[col] : false;
      features[fp.featureCode] = {
        namaFitur: fp.namaFitur,
        koinCost: fp.koinCost,
        globallyActive,
        inPackage,
        available: globallyActive && inPackage,
      };
    }

    res.status(200).json({ success: true, data: features });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
