// src/controllers/notification.controller.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ALERT_THRESHOLD_CRITICAL = 10;
const ALERT_THRESHOLD_WARNING = 25;

exports.getAdminAlerts = async (req, res) => {
  try {
    const alerts = [];

    // Ambil semua model AI yang aktif dan punya maxBudget
    const aiModels = await prisma.aiModel.findMany({
      where: {
        isActive: true,
        maxBudget: { gt: 0 },
      },
    });

    for (const model of aiModels) {
      const usage = await prisma.systemApiLog.aggregate({
        _sum: { cost_usd: true },
        where: { model_name: model.modelName },
      });

      const totalUsedUsd = Number(usage._sum.cost_usd ?? 0);
      const remainingUsd = model.maxBudget - totalUsedUsd;
      const remainingPercentage = (remainingUsd / model.maxBudget) * 100;

      if (remainingPercentage <= ALERT_THRESHOLD_CRITICAL) {
        alerts.push({
          type: "CRITICAL",
          source: "AI_BUDGET",
          model: model.modelName,
          message: `URGENT: Sisa limit tagihan model API ${model.modelName} tinggal ${remainingPercentage.toFixed(2)}% ($${remainingUsd.toFixed(2)} tersisa dari $${model.maxBudget}). Segera naikkan Max Budget atau isi saldo Provider AI.`,
          remaining_usd: parseFloat(remainingUsd.toFixed(2)),
          remaining_percentage: parseFloat(remainingPercentage.toFixed(2)),
          action_required: true,
        });
      } else if (remainingPercentage <= ALERT_THRESHOLD_WARNING) {
        alerts.push({
          type: "WARNING",
          source: "AI_BUDGET",
          model: model.modelName,
          message: `PERINGATAN: Sisa limit tagihan model API ${model.modelName} tinggal ${remainingPercentage.toFixed(2)}% ($${remainingUsd.toFixed(2)} tersisa dari $${model.maxBudget}).`,
          remaining_usd: parseFloat(remainingUsd.toFixed(2)),
          remaining_percentage: parseFloat(remainingPercentage.toFixed(2)),
          action_required: false,
        });
      }
    }

    // Urutkan: CRITICAL dulu, baru WARNING
    alerts.sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return order[a.type] - order[b.type];
    });

    return res.status(200).json({
      success: true,
      total_alerts: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error("[getAdminAlerts] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
