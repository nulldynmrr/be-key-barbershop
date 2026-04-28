const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getStats = async (req, res) => {
  try {
    // 1. Total Modal vs Total Terpakai
    const totalPurchase = await prisma.adminTokenPurchase.aggregate({
      _sum: { nominal_usd: true },
    });
    const totalUsage = await prisma.systemApiLog.aggregate({
      _sum: { cost_usd: true },
    });

    // 2. Pemakaian per Model (Biar tahu model mana yang paling laku)
    const usageByModel = await prisma.systemApiLog.groupBy({
      by: ["model_name"],
      _count: { id: true },
      _sum: { cost_usd: true },
    });

    // 3. User paling boros (Top Spender)
    const topUsers = await prisma.systemApiLog.groupBy({
      by: ["user_id"],
      _sum: { cost_usd: true },
      orderBy: { _sum: { cost_usd: "desc" } },
      take: 5,
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          balance_usd: (
            Number(totalPurchase._sum.nominal_usd || 0) -
            Number(totalUsage._sum.cost_usd || 0)
          ).toFixed(4),
          total_spent_usd: Number(totalUsage._sum.cost_usd || 0).toFixed(4),
          total_requests: await prisma.aIGeneration.count(),
        },
        usage_by_model: usageByModel,
        top_users: topUsers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/dashboard/activity-logs
exports.getActivityLogs = async (req, res) => {
  try {
    const logs = await prisma.systemApiLog.findMany({
      include: {
        user: {
          select: { nama: true, email: true }, // Biar tahu siapa yang pakai
        },
      },
      orderBy: { tgl_penggunaan: "desc" }, // Yang terbaru di atas
      take: 50, // Batasi 50 data terakhir biar gak berat
    });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
