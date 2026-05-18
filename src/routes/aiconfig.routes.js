const { Router } = require("express");
const {
  getExchangeSetting,
  updateExchangeSetting,
  getAiModels,
  getActiveModelsByType,
  saveAiModel,
  deleteAiModel,
  getAiUsageLogs,
  toggleModelStatus,
  testConnection,
  getFeaturePricing,
  getFeatureToggleMap,
  updateFeaturePrice,
  calculateIdealKoin,
  getAiModelBalance,
  syncModelBalance,
  parseCurl,
} = require("../controllers/aiconfig.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const router = Router();

router.use(verifyToken, isAdmin);

/**
 * @swagger
 * tags:
 *   - name: AI Engine Control
 *     description: Pengaturan Model AI, Kurs Mata Uang, dan Log Penggunaan
 */

/**
 * @swagger
 * /v1/ai-config/exchange:
 *   get:
 *     summary: Ambil Master Exchange Setting (Kurs, Buffer, Multiplier)
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil
 *   put:
 *     summary: Update Master Exchange Setting
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               globalMultiplier:
 *                 type: number
 *                 example: 1.35
 *               baseRateUsdIdr:
 *                 type: number
 *                 example: 17332
 *               inflationBuffer:
 *                 type: number
 *                 example: 0.05
 *     responses:
 *       200:
 *         description: Update berhasil
 */
router.get("/exchange", getExchangeSetting);
router.put("/exchange", updateExchangeSetting);

/**
 * @swagger
 * /v1/ai-config/models:
 *   get:
 *     summary: Ambil list konfigurasi Router AI
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil
 *   post:
 *     summary: Tambah Model AI Router Baru
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namaRouter:
 *                 type: string
 *               baseUrl:
 *                 type: string
 *               modelName:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               typeAi:
 *                 type: string
 *                 example: "IMAGE_GEN"
 *               pricingUnit:
 *                 type: string
 *                 example: "IMAGE"
 *                 description: "TOKEN (untuk LLM) atau IMAGE (untuk image gen)"
 *               hargaInput1M:
 *                 type: number
 *                 description: "Dipakai jika pricingUnit = TOKEN"
 *               hargaOutput1M:
 *                 type: number
 *                 description: "Dipakai jika pricingUnit = TOKEN"
 *               hargaPerImage:
 *                 type: number
 *                 example: 0.04
 *                 description: "Dipakai jika pricingUnit = IMAGE"
 *               maxBudget:
 *                 type: number
 *               rpmLimit:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Berhasil menyimpan config baru
 */
router.get("/models", getAiModels);

/**
 * @swagger
 * /v1/ai-config/models/active:
 *   get:
 *     summary: List model aktif dikelompokkan per tipe (LLM & IMAGE_GEN) — untuk dropdown pembuatan paket
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ llm: [...], image_gen: [...] }"
 */
router.get("/models/active", getActiveModelsByType);

router.post("/models", saveAiModel);

/**
 * @swagger
 * /ai-config/models/{id}:
 *   put:
 *     summary: Edit Model AI Router
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *   delete:
 *     summary: Hapus Model AI Router
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.put("/models/:id", saveAiModel);
router.delete("/models/:id", deleteAiModel);

/**
 * @swagger
 * /v1/ai-config/models/{id}/status:
 *   patch:
 *     summary: Toggle On/Off Router Aktif
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Status diupdate
 */
router.patch("/models/:id/status", toggleModelStatus);
router.get("/models/:id/balance", getAiModelBalance);
router.post("/models/:id/sync-balance", syncModelBalance);

/**
 * @swagger
 * /v1/ai-config/models/test-connection:
 *   post:
 *     summary: Ping koneksi ke API Provider
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               baseUrl:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Koneksi berhasil
 */
router.post("/models/test-connection", testConnection);

/**
 * @swagger
 * /v1/ai-config/logs:
 *   get:
 *     summary: Ambil tabel riwayat token, modal, dan profit
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Berhasil mengambil log penggunaan
 */
router.get("/logs", getAiUsageLogs);

/**
 * @swagger
 * /v1/ai-config/feature-pricing:
 *   get:
 *     summary: Ambil daftar harga koin per-fitur
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data pricing
 */
router.get("/feature-pricing", getFeaturePricing);

/**
 * @swagger
 * /v1/ai-config/feature-toggle:
 *   get:
 *     summary: Ambil map status global semua fitur AI (aktif/nonaktif oleh Admin)
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ STANDARD_SCAN: { id, namaFitur, isActive, koinCost }, ... }"
 */
router.get("/feature-toggle", getFeatureToggleMap);

/**
 * @swagger
 * /v1/ai-config/feature-pricing/{id}:
 *   put:
 *     summary: Update harga koin untuk fitur tertentu
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               koinCost:
 *                 type: integer
 *                 example: 5
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Berhasil update harga koin
 */
router.put("/feature-pricing/:id", updateFeaturePrice);

/**
 * @swagger
 * /v1/ai-config/calculate-ideal-koin:
 *   post:
 *     summary: Hitung estimasi koin ideal per 1x generate berdasarkan fitur aktif
 *     tags: [AI Engine Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               featVirtualTryOn:
 *                 type: boolean
 *               featSymmetry:
 *                 type: boolean
 *               featAdvMapping:
 *                 type: boolean
 *               featHistory:
 *                 type: boolean
 *               featTrendAnalysis:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Hasil estimasi koin ideal per 1 generate
 */
router.post("/calculate-ideal-koin", calculateIdealKoin);
router.post("/parse-curl", parseCurl);

module.exports = router;
