const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const mailService = require("../services/mail.service");
const { success, error: sendError } = require("../utils/response.helper");
const { creditPackagePurchase } = require("../services/package.service");

const createAuditLog = async (adminId, action, target = null, details = null, req = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        admin_id: adminId,
        action,
        target,
        details: details || {},
        ip_address: req?.ip || null,
        userAgent: req?.get("User-Agent") || null,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log:", err.message);
  }
};


const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
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

    return success(res, {
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const getUserDetail = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        ai_generations: { orderBy: { tgl_generate: "desc" }, take: 10 },
        system_api_logs: { orderBy: { tgl_penggunaan: "desc" }, take: 10 },
        active_package: { select: { id: true, namaPaket: true } },
        package_balances: {
          include: { package: { select: { namaPaket: true, jumlahKoin: true } } },
          orderBy: { purchased_at: "desc" },
        },
        transactions: { orderBy: { tgl_transaksi: "desc" }, take: 10 },
        _count: {
          select: {
            transactions: true,
            ai_generations: true,
            system_api_logs: true,
            feedbacks: true,
            package_balances: true,
          },
        },
      },
    });

    if (!user) {
      const error = new Error("User tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const { password, device_cookie, ...safeUser } = user;
    return success(res, { data: safeUser });
  } catch (error) {
    return sendError(res, {
      statusCode: error.statusCode || 500,
      message: error.message
    });
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

    await createAuditLog(req.user.id, "ADJUST_CREDIT", user.id, { delta, new_credit: user.sisa_credit, reason: req.body.reason }, req);


    return success(res, {
      message: "Credit berhasil diupdate",
      data: { id: user.id, sisa_credit: user.sisa_credit },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { message: error.message });
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

    await createAuditLog(req.user.id, "UPDATE_USER_STATUS", user.id, { is_banned }, req);


    return success(res, {
      message: is_banned ? "User berhasil dibanned" : "User berhasil di-unban",
      data: { id: user.id, is_banned: user.is_banned },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { message: error.message });
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

    await createAuditLog(req.user.id, "DELETE_USER", req.params.id, null, req);


    return success(res, { message: "User berhasil dihapus" });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { message: error.message });
  }
};

const topupPackage = async (req, res, next) => {
  try {
    const { packageId } = req.body;
    if (!packageId || typeof packageId !== "string") {
      const error = new Error("packageId wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      include: { llmModel: true, imageModel: true },
    });

    if (!pkg) {
      const error = new Error("Paket tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    if (pkg.status !== "AKTIF") {
      const error = new Error("Paket sedang nonaktif, tidak bisa di-top-up");
      error.statusCode = 400;
      throw error;
    }
    if (!pkg.llmModelId || !pkg.llmModel?.isActive) {
      const error = new Error("Model AI untuk paket ini sedang nonaktif");
      error.statusCode = 400;
      throw error;
    }
    if (pkg.featVirtualTryOn && (!pkg.imageModelId || !pkg.imageModel?.isActive)) {
      const error = new Error("Model Image Gen untuk paket ini sedang nonaktif");
      error.statusCode = 400;
      throw error;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      return creditPackagePurchase(tx, req.params.id, pkg);
    });

    await createAuditLog(req.user.id, "ADMIN_TOPUP_PACKAGE", req.params.id, { packageId, koin: pkg.jumlahKoin }, req);

    return success(res, {
      message: "Top-up paket berhasil",
      data: { sisa_credit: updatedUser.sisa_credit, active_package_id: updatedUser.active_package_id },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { statusCode: error.statusCode || 500, message: error.message });
  }
};

const setActivePackage = async (req, res, next) => {
  try {
    const { packageId } = req.body;
    if (packageId !== null && typeof packageId !== "string") {
      const error = new Error("packageId harus berupa string atau null");
      error.statusCode = 400;
      throw error;
    }

    if (packageId === null) {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { active_package_id: null, status_langganan: false, tipe_akun: "free" },
      });
      await createAuditLog(req.user.id, "ADMIN_REVOKE_ACTIVE_PACKAGE", user.id, {}, req);
      return success(res, {
        message: "Paket aktif berhasil dicabut",
        data: { id: user.id, active_package_id: user.active_package_id },
      });
    }

    const balance = await prisma.userPackageBalance.findUnique({
      where: { user_id_package_id: { user_id: req.params.id, package_id: packageId } },
    });

    if (!balance) {
      const error = new Error("User tidak punya saldo untuk paket ini");
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { active_package_id: packageId, status_langganan: true, tipe_akun: "premium" },
    });

    await createAuditLog(req.user.id, "ADMIN_SET_ACTIVE_PACKAGE", user.id, { packageId }, req);

    return success(res, {
      message: "Paket aktif berhasil diubah",
      data: { id: user.id, active_package_id: user.active_package_id },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { statusCode: error.statusCode || 500, message: error.message });
  }
};

const requestAdminOTP = async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!admin) {
      const error = new Error("Admin tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        otp,
        otpExpires,
      },
    });

    await mailService.sendOTP(admin.email, otp);

    if (req.log) req.log.info({ adminId: admin.id }, "Admin merequest OTP untuk perubahan profil/password");

    return success(res, { message: "Kode OTP telah dikirim ke email Anda" });
  } catch (error) {
    return sendError(res, {
      statusCode: error.statusCode || 500,
      message: error.message || "Terjadi kesalahan sistem saat mengirim OTP",
    });
  }
};

const updateAdminProfile = async (req, res, next) => {
  try {
    const { nama, password, otp } = req.body;
    const updateData = {};

    if (nama) updateData.nama = nama;

    if (password) {
      if (!otp) {
        const error = new Error("OTP wajib diisi untuk mengubah password");
        error.statusCode = 400;
        throw error;
      }

      const admin = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!admin.otp || admin.otp !== otp) {
        const error = new Error("Kode OTP salah atau tidak valid");
        error.statusCode = 400;
        throw error;
      }

      if (new Date() > admin.otpExpires) {
        const error = new Error("Kode OTP telah kadaluarsa, silakan request ulang");
        error.statusCode = 400;
        throw error;
      }

      if (password.length < 6) {
        const error = new Error("Password minimal 6 karakter");
        error.statusCode = 400;
        throw error;
      }
      updateData.password = await bcrypt.hash(password, 10);
      updateData.otp = null;
      updateData.otpExpires = null;
    }

    if (Object.keys(updateData).length === 0) {
      const error = new Error("Tidak ada data yang dikirim untuk diupdate");
      error.statusCode = 400;
      throw error;
    }

    const updatedAdmin = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, nama: true, email: true, role: true },
    });

    if (req.log) req.log.info({ adminId: req.user.id }, "Admin berhasil mengubah profil/password");

    await createAuditLog(req.user.id, "UPDATE_ADMIN_PROFILE", req.user.id, { updatedFields: Object.keys(updateData) }, req);


    return success(res, {
      message: "Profil admin berhasil diperbarui",
      data: updatedAdmin,
    });
  } catch (error) {
    return sendError(res, {
      statusCode: error.statusCode || 500,
      message: error.message
    });
  }
};

const getAdminProfile = async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return success(res, { data: admin });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: {
          admin: {
            select: { nama: true, email: true }
          }
        }
      }),
    ]);

    return success(res, {
      data: logs,
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
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const whereClause = {
      ...(search && {
        OR: [
          { invoice_number: { contains: search } },
          { reference_id: { contains: search } },
          { status: { contains: search } },
          { user: { nama: { contains: search } } },
          { user: { email: { contains: search } } }
        ]
      })
    };

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where: whereClause }),
      prisma.transaction.findMany({
        where: whereClause,
        orderBy: { tgl_transaksi: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              nama: true,
              email: true,
            },
          },
          package: {
            select: {
              namaPaket: true,
            },
          },
        },
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


module.exports = {
  getUsers,
  getUserDetail,
  adjustCredit,
  updateUserStatus,
  deleteUser,
  topupPackage,
  setActivePackage,
  updateAdminProfile,
  getAdminProfile,
  getAuditLogs,
  requestAdminOTP,
  getTransactions,
};
