const { Router } = require("express");
const {
  getUsers,
  getUserDetail,
  adjustCredit,
  updateUserStatus,
  deleteUser,
} = require("../controllers/admin.controller");
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
 * /admin/users/all:
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
 * /admin/users/{id}:
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
router.delete("/users/:id", deleteUser);

/**
 * @swagger
 * /admin/users/{id}/credit:
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
 * /admin/users/{id}/status:
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

module.exports = router;
