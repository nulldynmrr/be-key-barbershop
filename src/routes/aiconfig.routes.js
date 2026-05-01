import { Router } from "express";
import {
  getExchangeSetting,
  updateExchangeSetting,
  getAiModels,
  saveAiModel,
  deleteAiModel,
  getAiUsageLogs,
  toggleModelStatus,
  testConnection,
} from "../controllers/aiconfig.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: AI Engine Control
 *     description: Pengaturan Model AI, Kurs Mata Uang, dan Log Penggunaan
 */

// Semua rute diamankan untuk Admin
router.use(verifyToken, isAdmin);

// =====================================
// MASTER EXCHANGE ROUTES
// =====================================
/**
 * @swagger
 * /ai-config/exchange:
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

// =====================================
// AI MODEL CONFIG ROUTES (MAIA ROUTER)
// =====================================
/**
 * @swagger
 * /ai-config/models:
 *   get:
 *     summary: Ambil list konfigurasi Router AI (API Key otomatis disensor)
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
 *               hargaInput1M:
 *                 type: number
 *               hargaOutput1M:
 *                 type: number
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
 * /ai-config/models/{id}/status:
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

/**
 * @swagger
 * /ai-config/models/test-connection:
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
 *                 description: Kirim ID jika mengetes model yang sudah tersimpan
 *               baseUrl:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Koneksi berhasil
 */
router.post("/models/test-connection", testConnection);

// =====================================
// AI USAGE LOGS ROUTES
// =====================================
/**
 * @swagger
 * /ai-config/logs:
 *   get:
 *     summary: Ambil tabel riwayat token, modal, dan profit (Sesuai UI)
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

export default router;
