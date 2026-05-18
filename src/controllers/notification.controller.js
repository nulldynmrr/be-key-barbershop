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
        const deltaUsage = await prisma.systemApiLog.aggregate({
          _sum: { cost_usd: true },
          where: {
            model_name: model.modelName,
            tgl_penggunaan: model.last_sync_at ? { gte: model.last_sync_at } : undefined,
          },
        });

        const deltaUsed    = Number(deltaUsage._sum.cost_usd || 0);
        const baseBalance  = model.last_maia_balance ?? model.maxBudget;
        const remainingUsd = Math.max(0, Number(baseBalance) - deltaUsed);
        const usedTotal    = Number(model.maxBudget) - remainingUsd;
        const remainingPct = (remainingUsd / Number(model.maxBudget)) * 100;

        // Threshold dinaikkan: warning 20%, critical 5%
        if (remainingPct <= 20) {
          alerts.push({
            type: remainingPct <= 5 ? "CRITICAL" : "WARNING",
            source: "AI_BUDGET",
            model: model.namaRouter,
            usedUsd: usedTotal.toFixed(4),
            remainingUsd: remainingUsd.toFixed(4),
            remainingPct: remainingPct.toFixed(2),
            action_required: true,
            staleSyncWarning: model.last_sync_at
              ? (Date.now() - new Date(model.last_sync_at).getTime()) > 7 * 24 * 60 * 60 * 1000
                ? "⚠️ Saldo MAIA belum disync lebih dari 7 hari — kemungkinan ada selisih"
                : null
              : "⚠️ Saldo MAIA belum pernah disync",
            message: `${model.namaRouter}: estimasi sisa $${remainingUsd.toFixed(4)} (${remainingPct.toFixed(1)}%).`,
          });
        }

        // Alert terpisah bila sync sudah > 7 hari
        if (model.last_sync_at) {
          const daysSinceSync =
            (Date.now() - new Date(model.last_sync_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceSync > 7) {
            alerts.push({
              type: "INFO",
              source: "AI_BUDGET_SYNC",
              model: model.namaRouter,
              message: `Saldo MAIA untuk ${model.namaRouter} belum disync ${Math.floor(daysSinceSync)} hari. Buka dashboard MAIA dan update last_maia_balance.`,
              action_required: false,
            });
          }
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
