const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: Dashboard
 *     description: Statistik dan analitik keuangan admin
 */

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Ambil ringkasan statistik (User, Cost AI, Saldo USD)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Berhasil mengambil data statistik
 */
router.get("/stats", verifyToken, isAdmin, dashboardController.getStats);

/**
 * @swagger
 * /dashboard/logs:
 *   get:
 *     summary: Ambil riwayat aktivitas penggunaan AI mendetail
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Berhasil mengambil log aktivitas
 */
router.get("/logs", verifyToken, isAdmin, dashboardController.getActivityLogs);

module.exports = router;
