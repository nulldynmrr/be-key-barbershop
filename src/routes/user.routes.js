const { Router } = require("express");
const {
  getProfile,
  updateProfile,
  getAiHistory,
  getTransactions,
  resolveUserEmail,
  switchPackage,
} = require("../controllers/user.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const router = Router();

/**
 * @swagger
 * tags:
 *   name: User Area
 *   description: Endpoint khusus untuk pelanggan (memerlukan token login)
 */

router.use(verifyToken);

/**
 * @swagger
 * /users/profile:
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
 *             required:
 *               - nama
 *             properties:
 *               nama:
 *                 type: string
 *                 example: "Dinar Akbar"
 *     responses:
 *       200:
 *         description: Profil berhasil diupdate
 */
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

/**
 * @swagger
 * /users/ai-history:
 *   get:
 *     summary: Ambil riwayat generate AI milik sendiri
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Berhasil mengambil riwayat AI
 */
router.get("/ai-history", getAiHistory);

/**
 * @swagger
 * /users/transactions:
 *   get:
 *     summary: Ambil riwayat transaksi milik sendiri
 *     tags: [User Area]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Berhasil mengambil riwayat transaksi
 */
router.get("/transactions", getTransactions);
router.post("/switch-package", switchPackage);
// router.get("/:id/resolve-email", resolveUserEmail); // MOVED TO ADMIN ROUTES FOR SECURITY

module.exports = router;
