const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/topup", verifyToken, paymentController.createPayment);
router.post("/topup-manual", verifyToken, paymentController.topupManual);

/**
 * @swagger
 * /v1/payments/create-transaction:
 *   post:
 *     summary: Membuat transaksi pembayaran paket (belum diaktifkan sampai pembayaran selesai)
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
 *               amount:
 *                 type: number
 *               nama_paket:
 *                 type: string
 *               doku_payment_method:
 *                 type: string
 *                 description: "e.g. QRIS, VIRTUAL_ACCOUNT_BCA"
 *     responses:
 *       200:
 *         description: Berhasil membuat transaksi, dapatkan payment_url
 */
router.post(
  "/create-transaction",
  verifyToken,
  paymentController.createTransaction,
);

/**
 * @swagger
 * /v1/payments/status/{invoice}:
 *   get:
 *     summary: Cek status transaksi berdasarkan invoice number (untuk polling dari frontend)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoice
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status transaksi
 */
router.get(
  "/status/:invoice",
  verifyToken,
  paymentController.getTransactionStatus,
);

/**
 * @swagger
 * /v1/payments/buy-package:
 *   post:
 *     summary: Membeli paket dan mengaktifkan fitur paket tersebut (langsung tanpa payment gateway)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 */
router.post("/buy-package", verifyToken, paymentController.buyPackage);

/**
 * @swagger
 * /v1/payments/notification:
 *   post:
 *     summary: Webhook notification dari DOKU (dipanggil DOKU setelah pembayaran selesai)
 *     tags: [Payment]
 *     description: >
 *       Endpoint ini dipanggil oleh DOKU secara otomatis ketika pembayaran berhasil/gagal.
 *       Konfigurasi URL ini di DOKU Dashboard atau via additional_info.notification_url.
 *     responses:
 *       200:
 *         description: Notification diterima
 */
router.post("/notification", paymentController.paymentNotification);

/**
 * @swagger
 * /v1/payments/callback:
 *   post:
 *     summary: Webhook callback dari DOKU (legacy endpoint)
 *     tags: [Payment]
 */
router.post("/callback", paymentController.paymentCallback);

module.exports = router;
