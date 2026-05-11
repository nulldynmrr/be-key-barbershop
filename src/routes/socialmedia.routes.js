const express = require("express");
const router = express.Router();
const socialMediaController = require("../controllers/socialmedia.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const upload = require("../utils/upload");
const optimizeImage = require("../middleware/imageOptimizer.middleware");

/**
 * @swagger
 * tags:
 *   - name: SocialMedia
 *     description: Manajemen link Social Media
 */

/**
 * @swagger
 * /v1/social-media:
 *   get:
 *     summary: Ambil semua daftar social media
 *     tags: [SocialMedia]
 *     responses:
 *       200:
 *         description: Berhasil mengambil list social media
 *   post:
 *     summary: Tambah social media baru (Admin Only)
 *     tags: [SocialMedia]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - link
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Instagram"
 *               link:
 *                 type: string
 *                 example: "https://instagram.com/keybarber"
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Social media berhasil ditambahkan
 *       400:
 *         description: Bad request (title dan link harus diisi)
 */
router.get("/", socialMediaController.getSocialMedias);

router.post(
  "/",
  verifyToken,
  isAdmin,
  upload.single("image"),
  optimizeImage,
  socialMediaController.createSocialMedia
);


/**
 * @swagger
 * /v1/social-media/{id}:
 *   delete:
 *     summary: Hapus data social media (Admin Only)
 *     tags: [SocialMedia]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID Social Media
 *     responses:
 *       200:
 *         description: Social Media berhasil dihapus
 *       404:
 *         description: Social Media tidak ditemukan
 */
router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  socialMediaController.deleteSocialMedia
);

module.exports = router;
