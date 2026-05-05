const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAdminAlerts = async (req, res) => {
  try {
    const alerts = [];

    const aiModels = await prisma.aiModel.findMany({
      where: { isActive: true },
    });

    for (const model of aiModels) {
      if (model.maxBudget > 0) {
        const usage = await prisma.systemApiLog.aggregate({
          _sum: { cost_usd: true },
          where: { model_name: model.modelName },
        });

        const totalUsedUsd = Number(usage._sum.cost_usd || 0);
        const remainingPercentage =
          ((model.maxBudget - totalUsedUsd) / model.maxBudget) * 100;

        if (remainingPercentage <= 10) {
          alerts.push({
            type: "CRITICAL",
            source: "AI_BUDGET",
            message: `URGENT: Sisa limit tagihan model API ${model.modelName} tinggal ${remainingPercentage.toFixed(2)}% ($${(model.maxBudget - totalUsedUsd).toFixed(4)} tersisa). Segera isi saldo Provider AI.`,
            action_required: true,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      total_alerts: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error("Notification Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memuat notifikasi",
      error: error.message,
    });
  }
};
