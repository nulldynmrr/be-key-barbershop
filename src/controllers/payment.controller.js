const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");
const { getEffectivePackagePriceIdr } = require("../services/package.service");

exports.createPayment = async (req, res) => {
  // Placeholder: integrasi Payment Gateway (Midtrans/Duitku)
};

exports.topupManual = async (req, res) => {
  try {
    const { jumlah_credit } = req.body;
    const userId = req.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { sisa_credit: { increment: parseInt(jumlah_credit) } },
    });

    return success(res, {
      message: `Berhasil menambah ${jumlah_credit} credit.`,
      data: { sisa_credit_sekarang: updatedUser.sisa_credit },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

// Membeli paket: menambah koin user dan mengunci active_package_id ke paket yang dibeli
exports.buyPackage = async (req, res) => {
  try {
    const { package_id } = req.body;
    const userId = req.user.id;

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: package_id } });

    if (!pkg) {
      return sendError(res, { message: "Paket tidak ditemukan.", statusCode: 404 });
    }

    const nominalDibayar = getEffectivePackagePriceIdr(pkg);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update atau buat balance untuk paket ini (Opsi A: Top-up koin jika paket sama dibeli lagi)
      await tx.userPackageBalance.upsert({
        where: {
          user_id_package_id: {
            user_id: userId,
            package_id: pkg.id,
          },
        },
        update: {
          coins_purchased: { increment: pkg.jumlahKoin },
          coins_remaining: { increment: pkg.jumlahKoin },
        },
        create: {
          user_id: userId,
          package_id: pkg.id,
          coins_purchased: pkg.jumlahKoin,
          coins_remaining: pkg.jumlahKoin,
        },
      });

      // 2. Hitung total koin dari semua paket untuk di-sinkronkan ke sisa_credit
      const allBalances = await tx.userPackageBalance.findMany({
        where: { user_id: userId },
        select: { coins_remaining: true },
      });

      const totalCoins = allBalances.reduce((sum, b) => sum + b.coins_remaining, 0);

      // 3. Update User: Set paket aktif dan sinkronkan total koin
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          sisa_credit: totalCoins,
          active_package_id: pkg.id,
          status_langganan: true,
          tipe_akun: "premium",
        },
        include: { active_package: true }
      });

      // 4. Catat transaksi
      await tx.transaction.create({
        data: {
          user_id: userId,
          jenis_transaksi: "BUY_PACKAGE",
          nominal: nominalDibayar,
          status: "SUCCESS",
        },
      });

      return updatedUser;
    });

    return success(res, {
      message: `Berhasil membeli paket ${pkg.namaPaket}.`,
      data: {
        sisa_credit_sekarang: result.sisa_credit,
        active_package: result.active_package?.namaPaket || pkg.namaPaket,
      },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
