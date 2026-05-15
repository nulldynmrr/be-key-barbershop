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
  const finalTotalDipotong = Math.max(2, rawTotal);
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
    if (saveToHistory) {
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

    await tx.systemApiLog.create({
      data: {
        model_name: configAi.modelName,
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        cost_usd: realBilling.realCostUsd,
        koin_charged: billingBase.totalKoinFitur + realBilling.realKoinAi,
        service_fee_koin: billingBase.totalKoinFitur,
        token_fee_koin: realBilling.realKoinAi,
        features_used: JSON.stringify(activeFeatures),
        user_id: userId,
        ai_generation_id: aiRecord?.id || null,
        membership_snapshot: membershipName,
        charge_usd: calcChargeUsd(realBilling.realCostUsd),
      },
    });

    const logImageGen =
      configImageGen &&
      (igCost > 0 ||
        igKoin > 0 ||
        igUsage.prompt_tokens > 0 ||
        igUsage.completion_tokens > 0 ||
        igUsage.total_tokens > 0 ||
        urls.length > 0);

    if (logImageGen) {
      await tx.systemApiLog.create({
        data: {
          model_name: configImageGen.modelName,
          input_tokens: igUsage.prompt_tokens,
          output_tokens: igUsage.completion_tokens,
          total_tokens: igUsage.total_tokens,
          cost_usd: igCost,
          koin_charged: igKoin,
          service_fee_koin: 0,
          token_fee_koin: igKoin,
          features_used: JSON.stringify(["VIRTUAL_TRY_ON"]),
          user_id: userId,
          ai_generation_id: aiRecord?.id || null,
          membership_snapshot: membershipName,
          charge_usd: calcChargeUsd(igCost),
        },
      });
    }

    // 1. Re-verify credit balance inside the transaction to prevent race conditions
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { sisa_credit: true }
    });

    if (!isFreeTrial && currentUser.sisa_credit < finalTotalDipotong) {
      const err = new Error("Credit tidak mencukupi (terdeteksi perubahan saldo bersamaan).");
      err.statusCode = 402;
      err.errorCode = "INSUFFICIENT_CREDITS";
      throw err;
    }

    const amountToDeduct = isFreeTrial ? Math.min(currentUser.sisa_credit, finalTotalDipotong) : finalTotalDipotong;
    const sisa_credit_after = Math.max(0, currentUser.sisa_credit - amountToDeduct);

    await tx.user.update({
      where: { id: userId },
      data: { sisa_credit: { decrement: amountToDeduct } },
    });

    return { aiRecord, sisa_credit_after, totalDipotong: finalTotalDipotong };
  });

  return {
    resultTx: resultTx.aiRecord,
    sisa_credit_after: resultTx.sisa_credit_after,
    totalDipotong: resultTx.totalDipotong,
  };
};

module.exports = { dbTransactionNode };
