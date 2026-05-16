const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");

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
        active_package_id: true,
        active_package: true,
        package_balances: {
          include: {
            package: true
          }
        }
      },
    });

    console.log("Profile fetched:", user ? "Found" : "Not Found");

    if (!user) {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }

    return success(res, { data: user });
  } catch (error) {
    return sendError(res, { message: error.message });
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

    return success(res, {
      message: "Profil berhasil diupdate",
      data: user,
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const getAiHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
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

    const formattedHistory = history.map(item => {
      let activeFeatures = [];
      try {
        activeFeatures = item.features_used ? JSON.parse(item.features_used) : [];
      } catch (e) {
        activeFeatures = item.features_used ? item.features_used.split(',') : [];
      }
      return {
        ...item,
        active_features: activeFeatures,
        activeFeatures: activeFeatures // for redundancy
      };
    });

    return success(res, {
      data: formattedHistory,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
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

    return success(res, {
      data: transactions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const resolveUserEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true },
    });

    return success(res, {
      data: { email: user?.email || "Guest" },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const switchPackage = async (req, res, next) => {
  try {
    const { package_id } = req.body;
    const userId = req.user.id;

    if (!package_id) {
      return sendError(res, { statusCode: 400, message: "Package ID wajib diisi" });
    }

    // Check if user has balance for this package
    const balance = await prisma.userPackageBalance.findUnique({
      where: {
        user_id_package_id: {
          user_id: userId,
          package_id: package_id,
        },
      },
      include: { package: true }
    });

    if (!balance || balance.coins_remaining <= 0) {
      return sendError(res, { 
        statusCode: 400, 
        message: "Paket tidak tersedia atau koin sudah habis. Silakan beli kembali." 
      });
    }

    // Update active_package_id
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { active_package_id: package_id },
      include: { active_package: true }
    });

    return success(res, {
      message: `Berhasil berganti ke paket ${balance.package.namaPaket}`,
      data: {
        active_package: updatedUser.active_package,
        sisa_credit: updatedUser.sisa_credit
      }
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

module.exports = { getProfile, updateProfile, getAiHistory, getTransactions, resolveUserEmail, switchPackage };
