const express = require("express");
const router = express.Router();
const galleryController = require("../controllers/gallery.controller");
const upload = require("../utils/upload");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const optimizeImage = require("../middleware/imageOptimizer.middleware");


/**
 * @swagger
 * tags:
 *   - name: Gallery
 *     description: Manajemen foto gallery
 */

/**
 * @swagger
 * /v1/gallery:
 *   get:
 *     summary: Ambil semua daftar foto gallery
 *     tags: [Gallery]
 *     parameters:
 *       - in: query
 *         name: kategori
 *         schema:
 *           type: string
 *         description: Filter berdasarkan kategori (contoh "THE CLASSIC", "MODERN EDGE")
 *     responses:
 *       200:
 *         description: Berhasil mengambil list foto gallery
 *   post:
 *     summary: Tambah foto gallery baru (Admin Only)
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - kategori
 *               - image
 *             properties:
 *               kategori:
 *                 type: string
 *                 example: "THE CLASSIC"
 *                 description: Kategori foto (contoh "THE CLASSIC" atau "MODERN EDGE")
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: File foto yang akan diunggah
 *     responses:
 *       201:
 *         description: Foto gallery berhasil ditambahkan
 *       400:
 *         description: Bad request (gambar dan kategori wajib ada)
 */
router.get("/", galleryController.getAllGallery);

router.post(
  "/",
  verifyToken,
  isAdmin,
  upload.single("image"),
  optimizeImage,
  galleryController.createGallery
);

/**
 * @swagger
 * /v1/gallery/{id}:
 *   delete:
 *     summary: Hapus data foto gallery (Admin Only)
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID foto Gallery yang akan dihapus
 *     responses:
 *       200:
 *         description: Gallery berhasil dihapus beserta filenya
 *       404:
 *         description: Gallery tidak ditemukan
 */
router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  galleryController.deleteGallery
);

module.exports = router;
