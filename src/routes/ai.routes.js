const express = require("express");
const router = express.Router();
const multer = require("multer");
const { analyzeFace, getAvailableFeatures, generateTryOn } = require("../controllers/ai.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const optimizeImage = require("../middleware/imageOptimizer.middleware");
const { aiLimiter, distributedDedupe } = require("../middleware/security.middleware");
const upload = require("../utils/upload");

/**
 * @swagger
 * tags:
 *   - name: AI Analysis
 *     description: Analisis wajah menggunakan AI
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

router.post(
  "/analyze-face", 
  verifyToken, 
  aiLimiter,
  upload.single("foto"), 
  optimizeImage, 
  distributedDedupe(10), // 10s lock per user/route
  analyzeFace
);

router.post("/generate-tryon", verifyToken, generateTryOn);

module.exports = router;
