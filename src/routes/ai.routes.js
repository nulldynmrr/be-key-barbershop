const express = require("express");
const router = express.Router();
const multer = require("multer");
const { analyzeFace } = require("../controllers/ai.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// Multer config — simpan di memory buffer
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   - name: AI Analysis
 *     description: Analisis wajah menggunakan AI
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AnalysisFisik:
 *       type: object
 *       properties:
 *         gender:
 *           type: string
 *           example: "Pria"
 *         bentuk_wajah:
 *           type: string
 *           example: "Oval"
 *         bentuk_dahi:
 *           type: string
 *           example: "Proporsional"
 *         jenis_rambut:
 *           type: string
 *           example: "Lurus"
 *         struktur:
 *           type: string
 *           example: "Tebal"
 *     StylistNotes:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           example: "Modern Textured Fringe"
 *         description:
 *           type: string
 *           example: "Memanfaatkan kepadatan rambut untuk menciptakan tekstur berlapis"
 *     PremiumStyle:
 *       type: object
 *       properties:
 *         nama_gaya:
 *           type: string
 *           example: "Messy Quiff"
 *         skor:
 *           type: integer
 *           example: 88
 *     AiGenerationResult:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 5
 *         url_foto_upload:
 *           type: string
 *           example: "/uploads/ai_results/foto.jpg"
 *         harga_credit_terpakai:
 *           type: integer
 *           example: 1
 *         hasil_analisis:
 *           type: object
 *           properties:
 *             analisis_fisik:
 *               $ref: '#/components/schemas/AnalysisFisik'
 *             stylist_notes:
 *               $ref: '#/components/schemas/StylistNotes'
 *             premium_styles:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PremiumStyle'
 */

/**
 * @swagger
 * /v1/ai/analyze-face:
 *   post:
 *     summary: Analisis wajah untuk rekomendasi gaya rambut
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - foto
 *             properties:
 *               foto:
 *                 type: string
 *                 format: binary
 *                 description: Foto wajah (jpg/png)
 *     responses:
 *       200:
 *         description: Analisis berhasil
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
 *                   example: "Analisis berhasil"
 *                 data:
 *                   $ref: '#/components/schemas/AiGenerationResult'
 *       400:
 *         description: Foto tidak diunggah
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Harap unggah foto wajah."
 *       403:
 *         description: Credit tidak cukup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Credit tidak mencukupi."
 *       401:
 *         description: Unauthorized - Token tidak valid
 */
router.post("/analyze-face", verifyToken, upload.single("foto"), analyzeFace);

module.exports = router;
