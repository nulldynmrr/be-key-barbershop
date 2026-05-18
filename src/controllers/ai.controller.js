const { faceAnalysisSchema } = require("../validations/ai.validation");
const aiService = require("../services/ai");
const prisma = require("../config/prisma");
const { FEATURE_GATE_MAP } = require("../services/ai/featureGateMap");
const { success, error: sendError } = require("../utils/response.helper");

exports.analyzeFace = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, { statusCode: 400, message: "Harap unggah foto wajah." });
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
      return sendError(res, {
        statusCode: 400,
        errors: validation.error.errors.map((e) => e.message),
      });
    }

    // Set headers untuk streaming agar frontend bisa baca progress secara real-time
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const onStatusUpdate = (nodeName) => {
      res.write(JSON.stringify({ type: 'status', node: nodeName }) + '\n');
    };

    const result = await aiService.processFaceAnalysis(
      req.user.id,
      req.file,
      validation.data.requestedFeatures,
      req.body.source,
      onStatusUpdate
    );

    // Check photo violation penalty
    if (result.photo_violation_detected) {
      const errorPayload = {
        type: 'error',
        statusCode: 400,
        errorCode: "PHOTO_VIOLATION",
        message: result.violation_reason || "Kualitas foto tidak memadai! Koin dipotong 1.",
        credit_after: result.sisa_credit_after
      };
      res.write(JSON.stringify(errorPayload) + '\n');
      return res.end();
    }

    // Kirim hasil akhir
    res.write(JSON.stringify({ 
      type: 'final',
      message: result.kualitas_ok
        ? `Analisis berhasil. Total ${result.totalDipotong} koin terpotong.`
        : `Kualitas foto kurang baik: ${result.alasan}.`,
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
      }
    }) + '\n');
    
    return res.end();
  } catch (error) {
    // Jika error terjadi saat streaming sudah dimulai, kirim error dalam format JSON chunk
    const errorPayload = {
      type: 'error',
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "AI_PROCESSING_ERROR",
      message: error.message || "Gagal memproses AI.",
    };

    if (res.headersSent) {
      res.write(JSON.stringify(errorPayload) + '\n');
      return res.end();
    }

    return sendError(res, errorPayload);
  }
};

exports.getAvailableFeatures = async (req, res) => {
  try {
    const userId = req.user?.id;
    const pricingList = await prisma.featurePricing.findMany({ orderBy: { featureCode: "asc" } });

    let userPackages = [];
    if (userId) {
      const balances = await prisma.userPackageBalance.findMany({
        where: { 
          user_id: userId,
          coins_remaining: { gt: 0 }
        },
        include: { package: true },
      });
      userPackages = balances.map(b => b.package).filter(Boolean);
    }

    const features = {};
    for (const fp of pricingList) {
      const col = FEATURE_GATE_MAP[fp.featureCode];
      const globallyActive = fp.isActive;
      
      // Feature is in package if ANY of the user's packages has it set to true
      const inPackage = userPackages.some(pkg => !!pkg[col]);
      
      // Handle Free Trial logic for availability display
      let available = globallyActive && inPackage;
      
      if (!inPackage && req.user?.tipe_akun === "free" && (req.user?.sisa_credit || 0) > 0) {
        if (fp.featureCode === "STANDARD_SCAN" || fp.featureCode === "HISTORY") {
          available = globallyActive;
        }
      }
      
      features[fp.featureCode] = {
        namaFitur: fp.namaFitur,
        koinCost: fp.koinCost,
        globallyActive,
        inPackage,
        available,
      };
    }

    return success(res, { data: features });
  } catch (error) {
    return sendError(res, {
      statusCode: 500,
      message: "Gagal memuat daftar fitur.",
    });
  }
};

