const express = require("express");
const router = express.Router();
const multer = require("multer");
const { analyzeFace, getAvailableFeatures } = require("../controllers/ai.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const optimizeImage = require("../middleware/imageOptimizer.middleware");


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
 *           type: string
 *         user_id:
 *           type: string
 *         url_foto_upload:
 *           type: string
 *         harga_credit_terpakai:
 *           type: integer
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
 *               - requestedFeatures
 *             properties:
 *               foto:
 *                 type: string
 *                 format: binary
 *               requestedFeatures:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Analisis berhasil
 *       400:
 *         description: Foto tidak diunggah
 *       402:
 *         description: Credit tidak cukup
 *       401:
 *         description: Unauthorized
 */
/**
 * @swagger
 * /v1/ai/features:
 *   get:
 *     summary: Status global fitur AI + ketersediaan di paket user
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Map fitur: { globallyActive, inPackage, available, koinCost }"
 */
router.get("/features", verifyToken, getAvailableFeatures);

router.post("/analyze-face", verifyToken, upload.single("foto"), optimizeImage, analyzeFace);

module.exports = router;
