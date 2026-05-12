const prisma = require("../config/prisma");

const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const whereClause = {
      role: "user",
      ...(search && {
        OR: [{ nama: { contains: search } }, { email: { contains: search } }],
      }),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          nama: true,
          email: true,
          role: true,
          tipe_akun: true,
          sisa_credit: true,
          status_langganan: true,
          tgl_berakhir_langganan: true,
          is_banned: true,
          createdAt: true,
          _count: { select: { ai_generations: true } },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getUserDetail = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        ai_generations: { orderBy: { tgl_generate: "desc" }, take: 10 },
        system_api_logs: { orderBy: { tgl_penggunaan: "desc" }, take: 10 },
      },
    });

    if (!user) {
      const error = new Error("User tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const { password, device_cookie, ...safeUser } = user;
    res.status(200).json({ success: true, data: safeUser });
  } catch (error) {
    next(error);
  }
};

const adjustCredit = async (req, res, next) => {
  try {
    const delta = Number(req.body.amount);

    if (!Number.isFinite(delta)) {
      const error = new Error("Amount harus berupa angka");
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { sisa_credit: { increment: delta } },
    });

    if (req.log)
      req.log.info(
        { adminId: req.user?.id, targetUserId: user.id, delta },
        "Admin merubah saldo credit user",
      );

    res.status(200).json({
      success: true,
      message: "Credit berhasil diupdate",
      data: { id: user.id, sisa_credit: user.sisa_credit },
    });
  } catch (error) {
    if (error.code === "P2025") {
      const notFound = new Error("User tidak ditemukan");
      notFound.statusCode = 404;
      return next(notFound);
    }
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { is_banned } = req.body;

    if (typeof is_banned !== "boolean") {
      const error = new Error("is_banned harus berupa boolean");
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { is_banned },
    });

    if (req.log)
      req.log.info(
        { adminId: req.user?.id, targetUserId: user.id, is_banned },
        "Admin merubah status ban user",
      );

    res.status(200).json({
      success: true,
      message: is_banned ? "User berhasil dibanned" : "User berhasil di-unban",
      data: { id: user.id, is_banned: user.is_banned },
    });
  } catch (error) {
    if (error.code === "P2025") {
      const notFound = new Error("User tidak ditemukan");
      notFound.statusCode = 404;
      return next(notFound);
    }
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });

    if (req.log)
      req.log.info(
        { adminId: req.user?.id, targetUserId: req.params.id },
        "Admin menghapus user",
      );

    res.status(200).json({ success: true, message: "User berhasil dihapus" });
  } catch (error) {
    if (error.code === "P2025") {
      const notFound = new Error("User tidak ditemukan");
      notFound.statusCode = 404;
      return next(notFound);
    }
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserDetail,
  adjustCredit,
  updateUserStatus,
  deleteUser,
};
