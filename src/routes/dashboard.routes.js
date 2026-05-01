const { Router } = require("express");
const { getDashboardData } = require("../controllers/dashboard.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Dashboard Admin
 *     description: Endpoint statistik dan analitik keuangan admin (Terpadu)
 */
/**
 * @swagger
 * /v1/dashboard/main:
 *   get:
 *     summary: Ambil semua data statistik halaman utama dashboard
 *     tags: [Dashboard Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data dashboard
 */
router.get("/main", verifyToken, isAdmin, getDashboardData);

module.exports = router;
