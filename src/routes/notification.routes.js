const { Router } = require("express");
const { getAdminAlerts, getAllNotifications, markAsRead, markAllAsRead } = require("../controllers/notification.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Admin notification & alert management
 */

/**
 * @swagger
 * /v1/notifications/alerts:
 *   get:
 *     summary: Get admin system alerts
 *     description: >
 *       Mengembalikan daftar alert sistem untuk admin, termasuk peringatan
 *       ketika sisa budget AI model mendekati batas (≤ 10%).
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar alert berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total_alerts:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [CRITICAL, WARNING, INFO]
 *                         example: CRITICAL
 *                       source:
 *                         type: string
 *                         example: AI_BUDGET
 *                       message:
 *                         type: string
 *                         example: "URGENT: Sisa limit tagihan model API gpt-4o tinggal 8.50% ($1.70 tersisa)."
 *                       action_required:
 *                         type: boolean
 *                         example: true
 *       401:
 *         description: Token tidak valid atau tidak ada
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
 *                   example: Unauthorized
 *       403:
 *         description: Bukan admin
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
 *                   example: Forbidden
 *       500:
 *         description: Server error
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
 *                   example: Internal server error
 */
router.get("/alerts", verifyToken, isAdmin, getAdminAlerts);

/**
 * @swagger
 * /v1/notifications:
 *   get:
 *     summary: Ambil daftar notifikasi
 *     description: Digunakan untuk dropdown notification UI admin
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil notifikasi
 */
router.get("/", verifyToken, isAdmin, getAllNotifications);

/**
 * @swagger
 * /v1/notifications/mark-all-read:
 *   put:
 *     summary: Tandai semua notifikasi menjadi terbaca
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Semua notifikasi berhasil ditandai terbaca
 */
router.put("/mark-all-read", verifyToken, isAdmin, markAllAsRead);

/**
 * @swagger
 * /v1/notifications/{id}/read:
 *   put:
 *     summary: Tandai satu notifikasi menjadi terbaca
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID notifikasi
 *     responses:
 *       200:
 *         description: Notifikasi berhasil ditandai terbaca
 */
router.put("/:id/read", verifyToken, isAdmin, markAsRead);


module.exports = router;
