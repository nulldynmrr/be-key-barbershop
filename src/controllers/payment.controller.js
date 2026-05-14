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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        sisa_credit: { increment: pkg.jumlahKoin },
        active_package_id: pkg.id,
        status_langganan: true,
      },
    });

    const nominalDibayar = getEffectivePackagePriceIdr(pkg);

    await prisma.transaction.create({
      data: {
        user_id: userId,
        jenis_transaksi: "BUY_PACKAGE",
        nominal: nominalDibayar,
        status: "SUCCESS",
      },
    });

    return success(res, {
      message: `Berhasil membeli paket ${pkg.namaPaket}.`,
      data: {
        sisa_credit_sekarang: updatedUser.sisa_credit,
        active_package: pkg.namaPaket,
      },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
