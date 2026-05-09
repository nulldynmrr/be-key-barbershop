const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// TAMBAHKAN DUA BARIS INI UNTUK DEBUGGING:
console.log("Cek verifyToken:", typeof verifyToken);
console.log("Cek topupManual:", typeof paymentController.topupManual);

router.post("/topup", verifyToken, paymentController.createPayment);
// src/routes/payment.routes.js
router.post("/topup-manual", verifyToken, paymentController.topupManual);

/**
 * @swagger
 * /v1/payments/buy-package:
 *   post:
 *     summary: Membeli paket dan mengaktifkan fitur paket tersebut
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               package_id:
 *                 type: string
 *                 example: "uuid-paket"
 *     responses:
 *       200:
 *         description: Berhasil membeli paket
 */
router.post("/buy-package", verifyToken, paymentController.buyPackage);

module.exports = router;
