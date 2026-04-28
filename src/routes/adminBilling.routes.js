const express = require("express");
const router = express.Router();
const billingController = require("../controllers/adminBilling.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: Admin Billing
 *     description: Pencatatan modal beli saldo API ke MAIA
 */

/**
 * @swagger
 * /admin-billing/purchase:
 *   post:
 *     summary: Catat pembelian saldo baru
 *     tags: [Admin Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nama_paket
 *               - kos_total_idr
 *             properties:
 *               nama_paket:
 *                 type: string
 *                 example: "Paket $5 Starter"
 *               kos_total_idr:
 *                 type: integer
 *                 example: 80000
 *               jumlah_token:
 *                 type: integer
 *                 example: 500000
 *               nominal_usd:
 *                 type: number
 *                 example: 5
 *     responses:
 *       '201':
 *         description: Berhasil dicatat
 */
router.post(
  "/purchase",
  verifyToken,
  isAdmin,
  billingController.createPurchase,
);

/**
 * @swagger
 * /admin-billing/history:
 *   get:
 *     summary: Ambil riwayat pembelian saldo
 *     tags: [Admin Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Berhasil mengambil riwayat
 */
router.get(
  "/history",
  verifyToken,
  isAdmin,
  billingController.getPurchaseHistory,
);

module.exports = router;
