const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getProfile = async (req, res, next) => {
  try {
    console.log("Fetching profile for user:", req.user.id);
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        tipe_akun: true,
        sisa_credit: true,
        status_langganan: true,
        tgl_berakhir_langganan: true,
        createdAt: true,
        active_package: {
          select: {
            namaPaket: true
          }
        }
      },
    });

    console.log("Profile fetched:", user ? "Found" : "Not Found");

    if (!user) {
      const error = new Error("User tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Error in getProfile:", error);
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { nama } = req.body;

    if (!nama) {
      const error = new Error("Nama wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { nama },
      select: { id: true, nama: true, email: true },
    });

    if (req.log) req.log.info({ userId: req.user.id }, "User update profil");

    res.status(200).json({
      success: true,
      message: "Profil berhasil diupdate",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const getAiHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, history] = await Promise.all([
      prisma.aIGeneration.count({ where: { user_id: req.user.id } }),
      prisma.aIGeneration.findMany({
        where: { user_id: req.user.id },
        orderBy: { tgl_generate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: history,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where: { user_id: req.user.id } }),
      prisma.transaction.findMany({
        where: { user_id: req.user.id },
        orderBy: { tgl_transaksi: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, getAiHistory, getTransactions };
