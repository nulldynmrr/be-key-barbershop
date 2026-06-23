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
        errors: validation.error.issues.map((e) => e.message),
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

exports.generateTryOn = async (req, res) => {
  const fs = require("fs");
  const path = require("path");

  try {
    const { aiGenerationId } = req.body;
    if (!aiGenerationId) {
      return sendError(res, { statusCode: 400, message: "aiGenerationId wajib disertakan." });
    }

    const record = await prisma.aIGeneration.findUnique({
      where: { id: aiGenerationId },
    });

    if (!record) {
      return sendError(res, { statusCode: 404, message: "Record analisis AI tidak ditemukan." });
    }

    if (record.user_id !== req.user.id) {
      return sendError(res, { statusCode: 403, message: "Anda tidak berhak mengakses record ini." });
    }

    // Parse existing images
    let urls = [];
    if (record.url_hasil_img) {
      try {
        urls = typeof record.url_hasil_img === "string" 
          ? JSON.parse(record.url_hasil_img) 
          : record.url_hasil_img;
      } catch (e) {
        urls = [record.url_hasil_img];
      }
    }

    // If images are already generated, return them immediately
    if (Array.isArray(urls) && urls.filter(Boolean).length > 0) {
      return success(res, { 
        message: "Gambar virtual try-on sudah tersedia.",
        data: { url_hasil_img: urls } 
      });
    }

    // Retrieve user and image gen configurations
    const [user, configImageGen] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        include: { active_package: { include: { imageModel: true } } },
      }),
      prisma.aiModel.findFirst({ where: { isActive: true, typeAi: { in: ["IMAGE", "IMAGE_GEN"] } } }),
    ]);

    const isFreeTrial = !user.active_package_id;
    let userPackage = user.active_package;
    if (isFreeTrial) {
      userPackage = {
        namaPaket: "Free Trial",
        virtualTryOnLimit: 0,
        featVirtualTryOn: false,
      };
    }

    const activeImageModel = userPackage?.imageModel || configImageGen;
    if (!activeImageModel) {
      return sendError(res, { statusCode: 503, message: "Layanan AI (Image Gen) sedang tidak aktif." });
    }

    // Load original file to buffer
    const localPath = path.join(process.cwd(), record.url_foto_upload);
    if (!fs.existsSync(localPath)) {
      return sendError(res, { statusCode: 404, message: "Foto asli tidak ditemukan di server." });
    }

    const fileBuffer = fs.readFileSync(localPath);
    const mockFile = {
      buffer: fileBuffer,
      originalname: path.basename(record.url_foto_upload),
      mimetype: record.url_foto_upload.endsWith(".webp") ? "image/webp" : "image/jpeg",
    };

    const { generateVirtualTryOn } = require("../services/ai/core/imageGenClient");
    const tryOnResult = await generateVirtualTryOn(
      activeImageModel,
      mockFile,
      record.hasil_analisis,
      userPackage,
      isFreeTrial,
      path.basename(record.url_foto_upload),
      record.url_foto_upload
    );

    const generatedImageUrls = tryOnResult.generatedImageUrls ?? [];
    if (generatedImageUrls.length === 0) {
      return sendError(res, { 
        statusCode: 500, 
        message: "Gagal membuat gambar rekomendasi. Silakan coba lagi nanti." 
      });
    }

    // Calculate billing
    const sysConfig = await prisma.systemConfig.findFirst();
    const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
    const multiplier = sysConfig?.globalMultiplier || 1.35;
    const hargaPerKoinIdr = userPackage.jumlahKoin > 0 ? userPackage.hargaNominal / userPackage.jumlahKoin : 250;
    const billingBase = { rateIdr, multiplier, hargaPerKoinIdr };

    const { calculateRealBilling, normalizeOpenAiCompatibleUsage } = require("../services/ai/billing");
    const usageNorm = normalizeOpenAiCompatibleUsage(tryOnResult.imageGenUsage);
    const attemptCount = tryOnResult.imageGenAttemptCount || 1;
    const real = calculateRealBilling(usageNorm, activeImageModel, billingBase, 0, attemptCount);
    
    const imageGenCostUsd = real.realCostUsd;
    const imageGenKoin = real.realKoinAi;

    // Deduct coins inside transaction
    const resultTx = await prisma.$transaction(async (tx) => {
      if (!isFreeTrial) {
        const currentUser = await tx.user.findUnique({
          where: { id: req.user.id },
          select: { sisa_credit: true, active_package_id: true }
        });

        if (!currentUser.active_package_id) {
          const err = new Error("Anda tidak memiliki paket aktif.");
          err.statusCode = 403;
          throw err;
        }

        const allUserBalances = await tx.userPackageBalance.findMany({
          where: { user_id: req.user.id, coins_remaining: { gt: 0 } },
        });

        const sortedBalances = [...allUserBalances].sort((a, b) => {
          if (a.package_id === currentUser.active_package_id) return -1;
          if (b.package_id === currentUser.active_package_id) return 1;
          return a.purchased_at - b.purchased_at;
        });

        const totalAvailable = sortedBalances.reduce((sum, b) => sum + b.coins_remaining, 0);

        if (totalAvailable < imageGenKoin) {
          const err = new Error(`Total koin Anda (${totalAvailable}) tidak mencukupi untuk transaksi ini (Butuh ${imageGenKoin}). Silakan isi ulang.`);
          err.statusCode = 402;
          err.errorCode = "INSUFFICIENT_CREDITS";
          throw err;
        }

        let remainingToDeduct = imageGenKoin;
        for (const balance of sortedBalances) {
          if (remainingToDeduct <= 0) break;

          const amountFromThisPackage = Math.min(balance.coins_remaining, remainingToDeduct);
          await tx.userPackageBalance.update({
            where: { id: balance.id },
            data: { coins_remaining: { decrement: amountFromThisPackage } }
          });
          remainingToDeduct -= amountFromThisPackage;
        }
      }

      const allBalances = await tx.userPackageBalance.findMany({
        where: { user_id: req.user.id },
        select: { coins_remaining: true },
      });
      const totalSisaCredit = allBalances.reduce((sum, b) => sum + b.coins_remaining, 0);

      const updatedUser = await tx.user.update({
        where: { id: req.user.id },
        data: { sisa_credit: totalSisaCredit },
      });

      const updatedAiRecord = await tx.aIGeneration.update({
        where: { id: aiGenerationId },
        data: {
          url_hasil_img: generatedImageUrls,
          harga_credit_terpakai: { increment: imageGenKoin }
        }
      });

      const membershipName = isFreeTrial ? "FREE" : (user?.active_package?.namaPaket || "FREE");
      const calcChargeUsd = (cost) => isFreeTrial ? 0 : (Number(cost) * multiplier);

      await tx.systemApiLog.create({
        data: {
          model_name: activeImageModel.modelName,
          input_tokens: usageNorm.prompt_tokens,
          output_tokens: usageNorm.completion_tokens,
          total_tokens: usageNorm.total_tokens,
          cost_usd: imageGenCostUsd > 0 ? imageGenCostUsd : Number(activeImageModel.hargaPerImage),
          koin_charged: imageGenKoin,
          service_fee_koin: 0,
          token_fee_koin: imageGenKoin,
          features_used: JSON.stringify(["VIRTUAL_TRY_ON"]),
          user_id: req.user.id,
          ai_generation_id: record.id,
          membership_snapshot: membershipName,
          charge_usd: calcChargeUsd(imageGenCostUsd > 0 ? imageGenCostUsd : Number(activeImageModel.hargaPerImage)),
          attempt_count: tryOnResult.imageGenAttemptCount || 1,
          success_count: tryOnResult.imageGenSuccessCount || 0,
        },
      });

      return {
        url_hasil_img: updatedAiRecord.url_hasil_img,
        sisa_credit_after: updatedUser.sisa_credit
      };
    });

    return success(res, {
      message: "Gambar virtual try-on berhasil dibuat.",
      data: {
        url_hasil_img: resultTx.url_hasil_img,
        credit_after: resultTx.sisa_credit_after
      }
    });

  } catch (error) {
    console.error("[generateTryOn] Error:", error);
    return sendError(res, {
      statusCode: error.statusCode || 500,
      message: error.message || "Gagal memproses gambar rekomendasi.",
    });
  }
};

