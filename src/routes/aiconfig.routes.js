const express = require("express");
const router = express.Router();
const aiConfigController = require("../controllers/aiconfig.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: AI Config
 *     description: Konfigurasi AI Model (Admin only)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AiConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         router_name:
 *           type: string
 *           example: "MAIA Router"
 *         base_url:
 *           type: string
 *           example: "https://api.maiarouter.ai/v1"
 *         api_key:
 *           type: string
 *           example: "sk-xxxx"
 *         model_name:
 *           type: string
 *           example: "gpt-4o-mini"
 *         tipe_ai:
 *           type: string
 *           example: "face-analysis"
 *         is_active:
 *           type: boolean
 *           example: true
 *         tarif_input_per_1k:
 *           type: number
 *           example: 0.00015
 *         tarif_output_per_1k:
 *           type: number
 *           example: 0.0006
 *     AiConfigInput:
 *       type: object
 *       required:
 *         - router_name
 *         - api_key
 *         - model_name
 *         - tipe_ai
 *       properties:
 *         router_name:
 *           type: string
 *           example: "MAIA Router"
 *         base_url:
 *           type: string
 *           example: "https://api.maiarouter.ai/v1"
 *         api_key:
 *           type: string
 *           example: "sk-xxxx"
 *         model_name:
 *           type: string
 *           example: "gpt-4o-mini"
 *         tipe_ai:
 *           type: string
 *           example: "face-analysis"
 *         is_active:
 *           type: boolean
 *           example: true
 *         tarif_input_per_1k:
 *           type: number
 *           example: 0.00015
 *         tarif_output_per_1k:
 *           type: number
 *           example: 0.0006
 */

/**
 * @swagger
 * /ai-config:
 *   get:
 *     summary: Get semua AI config
 *     tags: [AI Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Berhasil
 */
router.get("/", verifyToken, isAdmin, aiConfigController.getAllConfigs);

/**
 * @swagger
 * /ai-config:
 *   post:
 *     summary: Tambah AI config baru
 *     tags: [AI Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AiConfigInput'
 *     responses:
 *       '201':
 *         description: Berhasil ditambah
 */
router.post("/", verifyToken, isAdmin, aiConfigController.createConfig);

/**
 * @swagger
 * /ai-config/{id}:
 *   put:
 *     summary: Update AI config
 *     tags: [AI Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AiConfigInput'
 *     responses:
 *       '200':
 *         description: Berhasil diupdate
 */
router.put("/:id", verifyToken, isAdmin, aiConfigController.updateConfig);

/**
 * @swagger
 * /ai-config/{id}:
 *   delete:
 *     summary: Hapus AI config
 *     tags: [AI Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Config berhasil dihapus
 */
router.delete("/:id", verifyToken, isAdmin, aiConfigController.deleteConfig);

module.exports = router;
