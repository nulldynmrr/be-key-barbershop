const prisma = require("../config/prisma");

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

    res.status(200).json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil notifikasi",
      error: error.message,
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });

    res.status(200).json({
      success: true,
      message: "Notifikasi dibaca",
      data: notification,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { is_read: false },
      data: { is_read: true },
    });

    res.status(200).json({
      success: true,
      message: "Semua notifikasi telah ditandai dibaca",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
