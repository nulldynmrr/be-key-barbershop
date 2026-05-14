const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");

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

    return success(res, {
      data: alerts,
      meta: { total_alerts: alerts.length }
    });
  } catch (error) {
    console.error("Notification Error:", error);
    return sendError(res, { message: "Gagal memuat notifikasi" });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.notification.count({
        where: { is_read: false },
      })
    ]);

    return success(res, {
      data: notifications,
      meta: { unreadCount }
    });
  } catch (error) {
    return sendError(res, { message: "Gagal mengambil notifikasi" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });

    return success(res, {
      message: "Notifikasi dibaca",
      data: notification,
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { is_read: false },
      data: { is_read: true },
    });

    return success(res, {
      message: "Semua notifikasi telah ditandai dibaca",
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
