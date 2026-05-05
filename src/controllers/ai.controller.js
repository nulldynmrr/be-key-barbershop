const { faceAnalysisSchema } = require("../validations/ai.validation");
const aiService = require("../services/ai.service");

exports.analyzeFace = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Harap unggah foto wajah." });
    }

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
        errors: validation.error.errors.map((e) => e.message),
      });
    }

    const result = await aiService.processFaceAnalysis(
      req.user.id,
      req.file,
      validation.data.requestedFeatures,
    );

    res.status(200).json({
      success: true,
      message: result.kualitas_ok
        ? `Analisis berhasil. Total ${result.totalDipotong} koin terpotong (Service: ${result.totalKoinFitur}, AI Token: ${result.realKoinAi}).`
        : `Kualitas foto kurang baik: ${result.alasan}. Total ${result.totalDipotong} koin tetap terpotong.`,
      data: result.resultTx,
      usage_info: {
        tokens: result.total_tokens,
        cost_usd: result.realCostUsd,
        service_fee: result.totalKoinFitur,
        token_fee: result.realKoinAi,
      },
    });
  } catch (error) {
    console.error("AI Controller Error:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Gagal memproses AI.",
    });
  }
};
