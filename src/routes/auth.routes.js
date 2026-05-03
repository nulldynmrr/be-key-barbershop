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
 * /v1/auth/google:
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
 * /v1/auth/guest-login:
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
 * /v1/auth/admin/login:
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
 * /v1/auth/register:
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
 * /v1/auth/user/register:
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

/**
 * @swagger
 * /v1/auth/forgot-password:
 *   post:
 *     summary: Permintaan reset password (Lupa Password)
 *     description: Mengirimkan instruksi reset password ke email. Secara keamanan (Security Best Practice), endpoint ini akan selalu mengembalikan status 200 meskipun email tidak terdaftar untuk mencegah Email Enumeration Attack.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "pelanggan@example.com"
 *     responses:
 *       200:
 *         description: Instruksi berhasil dikirim (atau email tidak ditemukan, pesan tetap sama)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Jika email terdaftar, instruksi reset akan dikirim."
 *       400:
 *         description: Data input tidak valid atau email kosong
 *       500:
 *         description: Kesalahan server internal
 */
router.post("/forgot-password", authController.forgotPassword);

module.exports = router;
