const prisma = require("../../../../config/prisma");
const { normalizeOpenAiCompatibleUsage } = require("../../billing");

const dbTransactionNode = async (state) => {
  const {
    userId,
    activeFeatures,
    hasil_analisis,
    generatedImageUrls,
    url_foto_upload,
    configAi,
    configImageGen,
    llmUsage,
    realBilling,
    billingBase,
    imageGenCostUsd,
    imageGenKoin,
    imageGenUsage,
    user,
    isFreeTrial,
    totalDipotong,
    imageFingerprint,
    featureFingerprint,
  } = state;

  const urls = generatedImageUrls ?? [];
  const saveToHistory = activeFeatures.includes("HISTORY");
  const mockTryOnImage = activeFeatures.includes("VIRTUAL_TRY_ON") ? urls : null;
  const igCost = imageGenCostUsd ?? 0;
  const igKoin = imageGenKoin ?? 0;
  const rawTotal = (billingBase?.totalKoinFitur || 0) + (realBilling?.realKoinAi || 0) + igKoin;
  let finalTotalDipotong = Math.max(2, rawTotal);

  if (state.photo_violation_detected) {
    finalTotalDipotong = 1;
  }
  const igUsage = normalizeOpenAiCompatibleUsage(imageGenUsage);
  const usage = normalizeOpenAiCompatibleUsage(llmUsage);

  const resultTx = await prisma.$transaction(async (tx) => {
    let aiRecord = null;
    
    // Fetch system config and current user status for historical snapshot
    const [config, fullUser] = await Promise.all([
      tx.systemConfig.findUnique({ where: { id: 1 } }),
      tx.user.findUnique({
        where: { id: userId },
        include: { active_package: true }
      })
    ]);

    const multiplier = config?.globalMultiplier || 1.35;
    const membershipName = isFreeTrial ? "FREE" : (fullUser?.active_package?.namaPaket || "FREE");
    
    // Charge for user: 0 if FREE, otherwise cost * multiplier
    const calcChargeUsd = (cost) => isFreeTrial ? 0 : (Number(cost) * multiplier);

    // Hanya CREATE — tidak menghapus/update history lama; daftar history user menumpuk selamanya.
    if (saveToHistory && !state.photo_violation_detected) {
      aiRecord = await tx.aIGeneration.create({
        data: {
          user_id: userId,
          image_hash: imageFingerprint || null,
          feature_fingerprint: featureFingerprint || null,
          url_foto_upload,
          url_hasil_img: mockTryOnImage,
          hasil_analisis,
          features_used: JSON.stringify(activeFeatures),
          harga_credit_terpakai: finalTotalDipotong,
        },
      });
    }

    let finalKoinCharged = billingBase.totalKoinFitur + realBilling.realKoinAi;
    let finalChargeUsd = calcChargeUsd(realBilling.realCostUsd);

    if (state.photo_violation_detected) {
      finalKoinCharged = 1;
      const hargaPerKoinUsd = billingBase.hargaPerKoinIdr / (billingBase.rateIdr || 16000);
      finalChargeUsd = isFreeTrial ? 0 : (finalKoinCharged * hargaPerKoinUsd);
    }

    await tx.systemApiLog.create({
      data: {
        model_name: configAi.modelName,
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        cost_usd: realBilling.realCostUsd,
        koin_charged: finalKoinCharged,
        service_fee_koin: state.photo_violation_detected ? 1 : billingBase.totalKoinFitur,
        token_fee_koin: state.photo_violation_detected ? 0 : realBilling.realKoinAi,
        features_used: JSON.stringify(activeFeatures),
        user_id: userId,
        ai_generation_id: aiRecord?.id || null,
        membership_snapshot: membershipName,
        charge_usd: finalChargeUsd,
      },
    });

    const imageGenWasAttempted =
      configImageGen != null &&
      state.activeFeatures?.includes("VIRTUAL_TRY_ON");

    const logImageGen = imageGenWasAttempted;

    if (logImageGen) {
      await tx.systemApiLog.create({
        data: {
          model_name: configImageGen.modelName,
          input_tokens: igUsage.prompt_tokens,
          output_tokens: igUsage.completion_tokens,
          total_tokens: igUsage.total_tokens,
          cost_usd: igCost > 0 ? igCost : Number(configImageGen.hargaPerImage),
          koin_charged: igKoin,
          service_fee_koin: 0,
          token_fee_koin: igKoin,
          features_used: JSON.stringify(["VIRTUAL_TRY_ON"]),
          user_id: userId,
          ai_generation_id: aiRecord?.id || null,
          membership_snapshot: membershipName,
          charge_usd: calcChargeUsd(igCost > 0 ? igCost : Number(configImageGen.hargaPerImage)),
          attempt_count: state.imageGenAttemptCount || 1,
          success_count: state.imageGenSuccessCount || 0,
        },
      });
    }

    // 1. Re-verify credit balance inside the transaction to prevent race conditions
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { sisa_credit: true, active_package_id: true }
    });

    if (!isFreeTrial) {
      if (!currentUser.active_package_id) {
        const err = new Error("Anda tidak memiliki paket aktif.");
        err.statusCode = 403;
        throw err;
      }

      // Fetch all packages with coins remaining
      const allUserBalances = await tx.userPackageBalance.findMany({
        where: { user_id: userId, coins_remaining: { gt: 0 } },
        orderBy: [
          { package_id: currentUser.active_package_id === null ? "asc" : (currentUser.active_package_id ? "desc" : "asc") }, // Simple trick to prioritize active (needs proper logic)
          { purchased_at: "asc" }
        ]
      });

      // Proper sorting: active first, then others by purchase date
      const sortedBalances = [...allUserBalances].sort((a, b) => {
        if (a.package_id === currentUser.active_package_id) return -1;
        if (b.package_id === currentUser.active_package_id) return 1;
        return a.purchased_at - b.purchased_at;
      });

      const totalAvailable = sortedBalances.reduce((sum, b) => sum + b.coins_remaining, 0);

      if (totalAvailable < finalTotalDipotong) {
        const err = new Error(`Total koin Anda (${totalAvailable}) tidak mencukupi untuk transaksi ini (Butuh ${finalTotalDipotong}). Silakan isi ulang.`);
        err.statusCode = 402;
        err.errorCode = "INSUFFICIENT_CREDITS";
        throw err;
      }

      let remainingToDeduct = finalTotalDipotong;
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

    // 2. Re-calculate total aggregate sisa_credit for the user
    const allBalances = await tx.userPackageBalance.findMany({
      where: { user_id: userId },
      select: { coins_remaining: true },
    });
    
    const totalSisaCredit = allBalances.reduce((sum, b) => sum + b.coins_remaining, 0);

    // 3. Update User table sisa_credit for synchronization
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { sisa_credit: totalSisaCredit },
    });

    return { aiRecord, sisa_credit_after: updatedUser.sisa_credit, totalDipotong: finalTotalDipotong };
  });

  return {
    resultTx: resultTx.aiRecord,
    sisa_credit_after: resultTx.sisa_credit_after,
    totalDipotong: resultTx.totalDipotong,
    photo_violation_detected: state.photo_violation_detected,
    violation_reason: state.violation_reason,
  };
};

module.exports = { dbTransactionNode };
