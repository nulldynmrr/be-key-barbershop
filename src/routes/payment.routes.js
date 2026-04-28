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

module.exports = router;
