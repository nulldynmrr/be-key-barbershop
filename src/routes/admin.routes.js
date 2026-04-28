const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Admin Management
 *   description: Kontrol penuh User, System, dan Feedback
 */

router.use(verifyToken, isAdmin);

/**
 * @swagger
 * /admin/users/all:
 *   get:
 *     summary: Ambil seluruh daftar user tanpa filter
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil semua data user
 */
router.get("/users/all", adminController.getAllUsers);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List semua user dengan filter search
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar user
 */
router.get("/users", adminController.getUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Detail user + riwayat
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail user
 *   delete:
 *     summary: Hapus user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User dihapus
 */
router.get("/users/:id", adminController.getUserDetail);
router.delete("/users/:id", adminController.deleteUser);

/**
 * @swagger
 * /admin/users/{id}/credit:
 *   patch:
 *     summary: Tambah/Kurangi credit
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       200:
 *         description: Credit diupdate
 */
router.patch("/users/:id/credit", adminController.adjustCredit);

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
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_banned:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Status diupdate
 */
router.patch("/users/:id/status", adminController.updateUserStatus);

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Ambil setting sistem
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil
 *   put:
 *     summary: Update setting sistem
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
 *               maintenance_mode:
 *                 type: boolean
 *                 example: false
 *               default_new_user_credit:
 *                 type: integer
 *                 example: 5
 *               global_price_multiplier:
 *                 type: number
 *                 example: 1.0
 *     responses:
 *       200:
 *         description: Diupdate
 */
router.get("/settings", adminController.getSettings);
router.put("/settings", adminController.updateSettings);

/**
 * @swagger
 * /admin/feedbacks:
 *   get:
 *     summary: Lihat semua feedback
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil
 */
router.get("/feedbacks", adminController.getFeedbacks);

/**
 * @swagger
 * /admin/feedbacks/{id}/resolve:
 *   patch:
 *     summary: Selesaikan feedback
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Selesai
 */
router.patch("/feedbacks/:id/resolve", adminController.resolveFeedback);

module.exports = router;
