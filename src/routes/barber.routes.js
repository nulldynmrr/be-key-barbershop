const express = require("express");
const router = express.Router();
const barberController = require("../controllers/barber.controller");
const upload = require("../utils/upload");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const optimizeImage = require("../middleware/imageOptimizer.middleware");


/**
 * @swagger
 * tags:
 *   - name: Barbers
 *     description: Manajemen data kapster/barber
 */

/**
 * @swagger
 * /barbers:
 *   get:
 *     summary: Ambil semua daftar barber
 *     tags: [Barbers]
 *     responses:
 *       200:
 *         description: Berhasil mengambil list barber
 *   post:
 *     summary: Tambah kapster baru (Admin Only)
 *     tags: [Barbers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nama_kapster:
 *                 type: string
 *               spesialisasi:
 *                 type: string
 *               pengalaman:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Barber berhasil ditambahkan
 */
router.get("/", barberController.getAllBarbers);

router.post(
  "/",
  verifyToken,
  isAdmin,
  upload.single("image"),
  optimizeImage,
  barberController.createBarber,
);

/**
 * @swagger
 * /barbers/{id}:
 *   put:
 *     summary: Edit data kapster/barber (Admin Only)
 *     tags: [Barbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID Barber
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nama_kapster:
 *                 type: string
 *               spesialisasi:
 *                 type: string
 *               pengalaman:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Barber berhasil diupdate
 *       404:
 *         description: Barber tidak ditemukan
 *   delete:
 *     summary: Hapus data kapster/barber (Admin Only)
 *     tags: [Barbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID Barber
 *     responses:
 *       200:
 *         description: Barber berhasil dihapus
 *       404:
 *         description: Barber tidak ditemukan
 */
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.single("image"),
  optimizeImage,
  barberController.updateBarber
);

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  barberController.deleteBarber
);

module.exports = router;
