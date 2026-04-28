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
 * /auth/profile:
 *   get:
 *     summary: Ambil profil user yang sedang login
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil profil
 *       401:
 *         description: Tidak terautentikasi
 */
router.get("/profile", verifyToken, authController.getProfile);

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
 *     summary: Registrasi akun baru
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
 *       400:
 *         description: Email sudah digunakan atau data tidak valid
 */
router.post("/register", authController.register);

module.exports = router;
