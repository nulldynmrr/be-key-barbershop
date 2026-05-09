const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

    res.status(200).json({
      success: true,
      message: `Berhasil menambah ${jumlah_credit} credit.`,
      sisa_credit_sekarang: updatedUser.sisa_credit,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Membeli paket: menambah koin user dan mengunci active_package_id ke paket yang dibeli
exports.buyPackage = async (req, res) => {
  try {
    const { package_id } = req.body;
    const userId = req.user.id;

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: package_id } });

    if (!pkg) {
      return res.status(404).json({ success: false, message: "Paket tidak ditemukan." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        sisa_credit: { increment: pkg.jumlahKoin },
        active_package_id: pkg.id,
        status_langganan: true,
      },
    });

    await prisma.transaction.create({
      data: {
        user_id: userId,
        jenis_transaksi: "BUY_PACKAGE",
        nominal: pkg.hargaNominal,
        status: "SUCCESS",
      },
    });

    res.status(200).json({
      success: true,
      message: `Berhasil membeli paket ${pkg.namaPaket}.`,
      sisa_credit_sekarang: updatedUser.sisa_credit,
      active_package: pkg.namaPaket,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
