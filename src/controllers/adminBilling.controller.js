const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.createPurchase = async (req, res) => {
  try {
    const { nama_paket, kos_total_idr, nominal_usd, jumlah_token } = req.body;

    const baseData = {
      nama_paket,
      kos_total_idr: Number(kos_total_idr),
    };

    const data = {
      ...baseData,
      ...(jumlah_token !== undefined && jumlah_token !== null
        ? { jumlah_token: Number(jumlah_token) }
        : {}),
      ...(nominal_usd !== undefined && nominal_usd !== null
        ? { nominal_usd: Number(nominal_usd) }
        : {}),
    };

    let purchase;
    try {
      purchase = await prisma.adminTokenPurchase.create({ data });
    } catch (error) {
      // Handle perbedaan field schema (jumlah_token vs nominal_usd) tanpa crash.
      const msg = String(error?.message || "");
      if (msg.includes("Unknown argument `jumlah_token`")) {
        const { jumlah_token: _jt, ...dataNoJumlahToken } = data;
        purchase = await prisma.adminTokenPurchase.create({ data: dataNoJumlahToken });
      } else if (msg.includes("Unknown argument `nominal_usd`")) {
        const { nominal_usd: _nu, ...dataNoNominalUsd } = data;
        purchase = await prisma.adminTokenPurchase.create({ data: dataNoNominalUsd });
      } else {
        throw error;
      }
    }

    res
      .status(201)
      .json({ success: true, message: "Saldo masuk dicatat!", data: purchase });
  } catch (error) {
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
