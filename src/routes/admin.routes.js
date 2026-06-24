const { Router } = require("express");
const {
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
} = require("../controllers/admin.controller");
const { resolveUserEmail } = require("../controllers/user.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin Management
 *   description: Kontrol penuh data User (Khusus Admin)
 */

router.use(verifyToken, isAdmin);

/**
 * @swagger
 * /v1/admin/users/all:
 *   get:
 *     summary: Ambil daftar semua user dengan pagination & search
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Cari berdasarkan nama atau email
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar user
 */
router.get("/users", getUsers);

/**
 * @swagger
 * /v1/admin/users/{id}:
 *   get:
 *     summary: Detail user beserta 10 riwayat transaksi/AI terakhir
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Berhasil mengambil detail user
 *   delete:
 *     summary: Hapus user dari sistem
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User berhasil dihapus
 */
router.get("/users/:id", getUserDetail);
router.get("/users/:id/resolve-email", resolveUserEmail);
router.delete("/users/:id", deleteUser);

/**
 * @swagger
 * /v1/admin/users/{id}/credit:
 *   patch:
 *     summary: Tambah/Kurangi credit user secara manual
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 example: 10
 *                 description: Gunakan angka minus (-10) untuk mengurangi credit
 *     responses:
 *       200:
 *         description: Credit berhasil diupdate
 */
router.patch("/users/:id/credit", adjustCredit);

/**
 * @swagger
 * /v1/admin/users/{id}/status:
 *   patch:
 *     summary: Ban atau Unban user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [is_banned]
 *             properties:
 *               is_banned:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Status ban user berhasil diupdate
 */
router.patch("/users/:id/status", updateUserStatus);

/**
 * @swagger
 * /v1/admin/users/{id}/topup-package:
 *   post:
 *     summary: Kredit koin paket tertentu ke user (simulasi pembelian manual)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packageId]
 *             properties:
 *               packageId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Top-up berhasil
 */
router.post("/users/:id/topup-package", topupPackage);

/**
 * @swagger
 * /v1/admin/users/{id}/active-package:
 *   patch:
 *     summary: Force-set atau cabut paket aktif user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packageId]
 *             properties:
 *               packageId:
 *                 type: string
 *                 nullable: true
 *                 description: uuid paket, atau null untuk mencabut paket aktif
 *     responses:
 *       200:
 *         description: Paket aktif berhasil diubah/dicabut
 */
router.patch("/users/:id/active-package", setActivePackage);

/**
 * @swagger
 * /v1/admin/profile:
 *   get:
 *     summary: Ambil profil admin yang sedang login
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil profil admin
 *   put:
 *     summary: Edit profil admin (Nama & Password)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil admin berhasil diperbarui
 */
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);

/**
 * @swagger
 * /v1/admin/request-otp:
 *   post:
 *     summary: Request OTP untuk perubahan password admin
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP berhasil dikirim ke email
 */
router.post("/request-otp", requestAdminOTP);

/**
 * @swagger
 * /v1/admin/audit-logs:
 *   get:
 *     summary: Ambil daftar log aktivitas admin
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Berhasil mengambil log aktivitas
 */
router.get("/audit-logs", getAuditLogs);
router.get("/transactions", getTransactions);


module.exports = router;
