const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const mailService = require("../services/mail.service");

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

    await createAuditLog(req.user.id, "ADJUST_CREDIT", user.id, { delta, new_credit: user.sisa_credit }, req);


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

    await createAuditLog(req.user.id, "UPDATE_USER_STATUS", user.id, { is_banned }, req);


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

    await createAuditLog(req.user.id, "DELETE_USER", req.params.id, null, req);


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

    res.status(200).json({
      success: true,
      message: "Kode OTP telah dikirim ke email Anda",
    });
  } catch (error) {
    console.error("OTP Request Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
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


    res.status(200).json({
      success: true,
      message: "Profil admin berhasil diperbarui",
      data: updatedAdmin,
    });
  } catch (error) {
    next(error);
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

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
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

    res.status(200).json({
      success: true,
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getUsers,
  getUserDetail,
  adjustCredit,
  updateUserStatus,
  deleteUser,
  updateAdminProfile,
  getAdminProfile,
  getAuditLogs,
  requestAdminOTP,
};
