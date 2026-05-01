const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const formatNumberShort = (num) => {
  if (num >= 1000000)
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toString();
};

const getDashboardData = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      configSistem,
      totalUsersCount,
      totalPendapatanResult,
      totalPengeluaranAIResult,
      modelAiUsage,
      recentAiAnalysis,
      userStatsRaw,
      chartDataRaw,
      totalBeliToken,
      totalPakaiToken,
    ] = await Promise.all([
      prisma.systemConfig.findFirst(),
      prisma.user.count({ where: { role: "user" } }),
      prisma.transaction.aggregate({
        _sum: { nominal: true },
        where: { status: "SUCCESS" },
      }),
      prisma.systemApiLog.aggregate({
        _sum: { cost_usd: true },
      }),
      prisma.systemApiLog.groupBy({
        by: ["model_name"],
        _count: { id: true },
      }),
      prisma.user.findMany({
        where: { role: "user" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          email: true,
          sisa_credit: true,
          tipe_akun: true,
          _count: { select: { ai_generations: true } },
        },
      }),
      prisma.user.groupBy({
        by: ["tipe_akun"],
        _count: { id: true },
        where: { role: "user" },
      }),
      prisma.transaction.findMany({
        where: {
          status: "SUCCESS",
          tgl_transaksi: { gte: sevenDaysAgo },
        },
        select: { tgl_transaksi: true, nominal: true },
        orderBy: { tgl_transaksi: "asc" },
      }),
      prisma.adminTokenPurchase.aggregate({
        _sum: { jumlah_token: true },
      }),
      prisma.systemApiLog.aggregate({
        _sum: { total_tokens: true },
      }),
    ]);

    const totalPendapatan = totalPendapatanResult._sum.nominal || 0;
    const kursAsumsi = configSistem?.baseRateUsdIdr || 16000;
    const pengeluaranUsd = Number(totalPengeluaranAIResult._sum.cost_usd || 0);
    const totalPengeluaranIdr = pengeluaranUsd * kursAsumsi;

    const tokenDibeli = totalBeliToken._sum.jumlah_token || 0;
    const tokenDipakai = totalPakaiToken._sum.total_tokens || 0;
    const sisaTokenMurni = tokenDibeli - tokenDipakai;

    const groupedPendapatan = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
      });
      groupedPendapatan[dateStr] = 0;
    }

    chartDataRaw.forEach((trx) => {
      const dateStr = new Date(trx.tgl_transaksi).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
      });
      if (groupedPendapatan[dateStr] !== undefined) {
        groupedPendapatan[dateStr] += trx.nominal;
      }
    });

    const formattedChartPendapatan = Object.keys(groupedPendapatan).map(
      (date) => ({
        date,
        value: groupedPendapatan[date],
      }),
    );

    const formattedRecentAnalysis = recentAiAnalysis.map((user) => ({
      email: user.email || "Unknown/Guest",
      total_credit: `${user.sisa_credit} Credit`,
      total_generate: `${user._count.ai_generations} Generate`,
      status: user.tipe_akun.toUpperCase(),
    }));

    const totalAiUsageCount = modelAiUsage.reduce(
      (acc, curr) => acc + curr._count.id,
      0,
    );
    const formattedModelAi = modelAiUsage.map((model) => ({
      name: model.model_name,
      percentage:
        totalAiUsageCount > 0
          ? Math.round((model._count.id / totalAiUsageCount) * 100)
          : 0,
    }));

    const totalUserStatsCount = userStatsRaw.reduce(
      (acc, curr) => acc + curr._count.id,
      0,
    );
    const formattedUserStats = userStatsRaw.map((stat) => ({
      type: stat.tipe_akun,
      count: stat._count.id,
      percentage:
        totalUserStatsCount > 0
          ? Math.round((stat._count.id / totalUserStatsCount) * 100)
          : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        kpi: {
          total_users: totalUsersCount,
          total_pendapatan_idr: totalPendapatan,
          pengeluaran_ai_idr: Math.round(totalPengeluaranIdr),
          sisa_token_ai: formatNumberShort(sisaTokenMurni),
        },
        chart_pendapatan: formattedChartPendapatan,
        pie_model_ai: formattedModelAi,
        table_analisis_terbaru: formattedRecentAnalysis,
        pie_statistik_user: formattedUserStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardData };
