const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Autentikasi dan manajemen akun
 */

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Login menggunakan Google OAuth
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google ID token dari client
 *     responses:
 *       200:
 *         description: Login berhasil
 *       401:
 *         description: Token tidak valid
 */
router.post("/google", authController.googleLogin);

/**
 * @swagger
 * /auth/guest-login:
 *   post:
 *     summary: Login sebagai tamu (tanpa akun)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Login tamu berhasil
 */
router.post("/guest-login", authController.guestLogin);

/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: Login khusus admin
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login admin berhasil
 *       403:
 *         description: Bukan admin atau kredensial salah
 */
router.post("/admin/login", authController.adminLogin);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrasi Admin Baru (Internal Use Only)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nama
 *               - email
 *               - password
 *             properties:
 *               nama:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registrasi berhasil
 */
router.post("/register", authController.register);

/**
 * @swagger
 * /auth/user/register:
 *   post:
 *     summary: Registrasi Akun Pelanggan (User Biasa)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nama
 *               - email
 *               - password
 *             properties:
 *               nama:
 *                 type: string
 *                 example: "Dinar Muhammad Akbar"
 *               email:
 *                 type: string
 *                 example: "dinar@example.com"
 *               password:
 *                 type: string
 *                 example: "rahasia123"
 *     responses:
 *       201:
 *         description: Akun User berhasil dibuat dan token diterbitkan
 *       400:
 *         description: Email sudah digunakan atau data tidak lengkap
 */
router.post("/user/register", authController.userRegister);

module.exports = router;
