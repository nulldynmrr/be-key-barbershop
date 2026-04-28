const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: User Area
 *   description: Endpoint khusus untuk pelanggan (memerlukan token login)
 */

router.use(verifyToken);

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Ambil profil diri sendiri
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil profil
 *   put:
 *     summary: Update profil diri sendiri
 *     tags: [User Area]
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
 *                 example: "Budi Santoso"
 *     responses:
 *       200:
 *         description: Profil berhasil diupdate
 */
router.get("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);

/**
 * @swagger
 * /user/ai-history:
 *   get:
 *     summary: Ambil riwayat generate AI milik sendiri
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil riwayat AI
 */
router.get("/ai-history", userController.getAiHistory);

/**
 * @swagger
 * /user/transactions:
 *   get:
 *     summary: Ambil riwayat transaksi milik sendiri
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil riwayat transaksi
 */
router.get("/transactions", userController.getTransactions);

/**
 * @swagger
 * /user/feedbacks:
 *   get:
 *     summary: Lihat daftar feedback yang pernah dikirim
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil feedback
 *   post:
 *     summary: Kirim feedback ke admin
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 example: "Saran tampilan"
 *               message:
 *                 type: string
 *                 example: "Tolong tambahkan fitur dark mode"
 *     responses:
 *       201:
 *         description: Feedback berhasil dikirim
 */
router.get("/feedbacks", userController.getMyFeedbacks);
router.post("/feedbacks", userController.submitFeedback);

module.exports = router;
