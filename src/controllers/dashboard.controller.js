const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getDashboardMain = async (req, res) => {
  try {
    const now = new Date();

    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const calcTrend = (curr, past) => {
      if (curr <= past) return 0;
      if (past === 0) return 100;
      const trend = ((curr - past) / past) * 100;
      return Number(trend.toFixed(2));
    };

    const detectPeriod = async () => {
      const hourlyUser = await prisma.user.count({
        where: { role: "user", createdAt: { gte: oneHourAgo } },
      });
      const hourlyTx = await prisma.transaction.count({
        where: { status: "SUCCESS", tgl_transaksi: { gte: oneHourAgo } },
      });
      const hourlyAi = await prisma.systemApiLog.count({
        where: { tgl_penggunaan: { gte: oneHourAgo } },
      });
      if (hourlyUser > 0 || hourlyTx > 0 || hourlyAi > 0) {
        return {
          label: "dari 1 jam terakhir",
          currentStart: oneHourAgo,
          pastStart: twoHoursAgo,
          pastEnd: oneHourAgo,
        };
      }

      const dailyUser = await prisma.user.count({
        where: { role: "user", createdAt: { gte: oneDayAgo } },
      });
      const dailyTx = await prisma.transaction.count({
        where: { status: "SUCCESS", tgl_transaksi: { gte: oneDayAgo } },
      });
      const dailyAi = await prisma.systemApiLog.count({
        where: { tgl_penggunaan: { gte: oneDayAgo } },
      });
      if (dailyUser > 0 || dailyTx > 0 || dailyAi > 0) {
        return {
          label: "dari 1 hari terakhir",
          currentStart: oneDayAgo,
          pastStart: twoDaysAgo,
          pastEnd: oneDayAgo,
        };
      }

      return {
        label: "dari 7 hari terakhir",
        currentStart: sevenDaysAgo,
        pastStart: fourteenDaysAgo,
        pastEnd: sevenDaysAgo,
      };
    };

    const period = await detectPeriod();
    const { label: trendLabel, currentStart, pastStart, pastEnd } = period;

    const totalUsers = await prisma.user.count({ where: { role: "user" } });
    const currentUsers = await prisma.user.count({
      where: { role: "user", createdAt: { gte: currentStart } },
    });
    const pastUsers = await prisma.user.count({
      where: { role: "user", createdAt: { gte: pastStart, lt: pastEnd } },
    });

    const totalTx = await prisma.transaction.aggregate({
      _sum: { nominal: true },
      where: { status: "SUCCESS" },
    });
    const currentTx = await prisma.transaction.aggregate({
      _sum: { nominal: true },
      where: { status: "SUCCESS", tgl_transaksi: { gte: currentStart } },
    });
    const pastTx = await prisma.transaction.aggregate({
      _sum: { nominal: true },
      where: {
        status: "SUCCESS",
        tgl_transaksi: { gte: pastStart, lt: pastEnd },
      },
    });

    const totalAi = await prisma.systemApiLog.aggregate({
      _sum: { cost_usd: true, total_tokens: true },
    });
    const currentAi = await prisma.systemApiLog.aggregate({
      _sum: { cost_usd: true, total_tokens: true },
      where: { tgl_penggunaan: { gte: currentStart } },
    });
    const pastAi = await prisma.systemApiLog.aggregate({
      _sum: { cost_usd: true, total_tokens: true },
      where: { tgl_penggunaan: { gte: pastStart, lt: pastEnd } },
    });

    const config = await prisma.systemConfig.findFirst();
    const rateIdr = config ? config.baseRateUsdIdr : 16000;

    const totalPendapatanIdr = totalTx._sum.nominal || 0;
    const currentPendapatanIdr = currentTx._sum.nominal || 0;
    const pastPendapatanIdr = pastTx._sum.nominal || 0;

    const totalPengeluaranIdr = Number(totalAi._sum.cost_usd || 0) * rateIdr;
    const currentPengeluaranIdr =
      Number(currentAi._sum.cost_usd || 0) * rateIdr;
    const pastPengeluaranIdr = Number(pastAi._sum.cost_usd || 0) * rateIdr;

    const allModels = await prisma.aiModel.findMany();
    let maxTokensAllowed = 0;
    let aiModelStats = [];

    for (const model of allModels) {
      const avgPrice1M = (model.hargaInput1M + model.hargaOutput1M) / 2;
      const modelMaxTokens =
        avgPrice1M > 0 ? (model.maxBudget / avgPrice1M) * 1000000 : 0;
      maxTokensAllowed += modelMaxTokens;

      const usage = await prisma.systemApiLog.aggregate({
        _sum: { cost_usd: true },
        where: { model_name: model.modelName },
      });

      const costUsd = Number(usage._sum.cost_usd || 0);
      let sisaPercentage = 0;
      if (model.maxBudget > 0) {
        sisaPercentage = Math.max(
          0,
          ((model.maxBudget - costUsd) / model.maxBudget) * 100,
        );
      }

      aiModelStats.push({
        modelName: model.modelName,
        sisaPercentage: Number(sisaPercentage.toFixed(0)),
      });
    }

    const totalTokensUsedVal = totalAi._sum.total_tokens || 0;
    const currentTokensUsedVal = currentAi._sum.total_tokens || 0;
    const pastTokensUsedVal = pastAi._sum.total_tokens || 0;

    const tokensAvailable = Math.max(0, maxTokensAllowed - totalTokensUsedVal);
    const isTokenCritical =
      maxTokensAllowed > 0 && tokensAvailable < maxTokensAllowed * 0.1;

    const pastTokensAvailable = Math.max(0, maxTokensAllowed - pastTokensUsedVal);
    const displayTokenTrend = calcTrend(tokensAvailable, pastTokensAvailable);
    const tokenTrendDirection = tokensAvailable >= pastTokensAvailable ? "up" : "down";

    const transactionsLast30Days = await prisma.transaction.findMany({
      where: {
        status: "SUCCESS",
        tgl_transaksi: { gte: thirtyDaysAgo },
      },
      select: {
        nominal: true,
        tgl_transaksi: true,
      },
      orderBy: { tgl_transaksi: "asc" },
    });

    const groupedRevenue = transactionsLast30Days.reduce((acc, tx) => {
      const dateString = tx.tgl_transaksi.toISOString().split("T")[0];
      if (!acc[dateString]) acc[dateString] = 0;
      acc[dateString] += tx.nominal;
      return acc;
    }, {});

    const revenueChartData = Object.keys(groupedRevenue).map((date) => ({
      date,
      total: groupedRevenue[date],
    }));

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [totalGenerationsCount, recentGenerations] = await Promise.all([
      prisma.aIGeneration.count(),
      prisma.aIGeneration.findMany({
        skip,
        take: limit,
        orderBy: { tgl_generate: "desc" },
        include: {
          user: {
            select: {
              email: true,
              sisa_credit: true,
              tipe_akun: true,
              active_package_id: true,
              active_package: { select: { namaPaket: true } },
              _count: { select: { ai_generations: true } },
            },
          },
        },
      }),
    ]);

    const recentAnalysisTable = recentGenerations.map((gen) => ({
      email: gen.user?.email || "Unknown",
      credit: `${gen.user?.sisa_credit || 0} Credit`,
      generate: `${gen.user?._count?.ai_generations || 0} Generate`,
      status: gen.user?.active_package?.namaPaket ? gen.user.active_package.namaPaket.toUpperCase() : "FREE",
    }));

    const [memberCount, guestCount] = await Promise.all([
      prisma.user.count({ where: { active_package_id: { not: null } } }),
      prisma.user.count({ where: { active_package_id: null } }),
    ]);

    const totalStatsUsers = memberCount + guestCount;
    const userStats = [];
    
    if (memberCount > 0) {
      userStats.push({
        label: "Member",
        count: memberCount,
        percentage: Number(((memberCount / totalStatsUsers) * 100).toFixed(1)),
        color: "#4a1a1a",
      });
    }
    
    if (guestCount > 0) {
      userStats.push({
        label: "Guest",
        count: guestCount,
        percentage: Number(((guestCount / totalStatsUsers) * 100).toFixed(1)),
        color: "#fbbf24",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        trendLabel,
        summaryCards: {
          users: {
            currentValue: totalUsers,
            trendPercentage: calcTrend(currentUsers, pastUsers),
            trendDirection: currentUsers >= pastUsers ? "up" : "down",
            trendLabel,
          },
          pendapatan: {
            currentValue: totalPendapatanIdr,
            trendPercentage: calcTrend(currentPendapatanIdr, pastPendapatanIdr),
            trendDirection:
              currentPendapatanIdr >= pastPendapatanIdr ? "up" : "down",
            trendLabel,
          },
          pengeluaranAi: {
            currentValue: totalPengeluaranIdr,
            trendPercentage: calcTrend(
              currentPengeluaranIdr,
              pastPengeluaranIdr,
            ),
            trendDirection:
              currentPengeluaranIdr >= pastPengeluaranIdr ? "up" : "down",
            trendLabel,
          },
          sisaToken: {
            currentValue: tokensAvailable,
            trendPercentage: displayTokenTrend,
            trendDirection: tokenTrendDirection,
            isCritical: isTokenCritical,
            trendLabel,
          },
        },
        revenueChart: revenueChartData,
        aiModelsChart: aiModelStats,
        recentAnalysis: recentAnalysisTable,
        recentAnalysisMeta: {
          total: totalGenerationsCount,
          page,
          limit,
          totalPages: Math.ceil(totalGenerationsCount / limit),
        },
        userStats: userStats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
