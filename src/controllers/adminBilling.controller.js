const prisma = require("../config/prisma");

exports.createPurchase = async (req, res) => {
  try {
    const { nama_paket, kos_total_idr, nominal_usd, jumlah_token } = req.body;

    if (!nama_paket || kos_total_idr === undefined || kos_total_idr === null) {
      return res.status(400).json({
        success: false,
        message: "nama_paket dan kos_total_idr wajib diisi",
      });
    }

    const purchase = await prisma.adminTokenPurchase.create({
      data: {
        nama_paket,
        kos_total_idr: Number(kos_total_idr),
        nominal_usd: nominal_usd !== undefined && nominal_usd !== null ? Number(nominal_usd) : 0,
        jumlah_token:
          jumlah_token !== undefined && jumlah_token !== null ? Number(jumlah_token) : null,
      },
    });

    res.status(201).json({ success: true, message: "Saldo masuk dicatat!", data: purchase });
  } catch (error) {
    console.error("[AdminBilling]", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPurchaseHistory = async (req, res) => {
  try {
    const history = await prisma.adminTokenPurchase.findMany({
      orderBy: { tgl_pembelian: "desc" },
    });

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
