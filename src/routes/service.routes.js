const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/service.controller");
const upload = require("../utils/upload");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: Services
 *     description: Manajemen layanan potong rambut
 */

/**
 * @swagger
 * /services:
 *   get:
 *     summary: Ambil daftar layanan
 *     tags: [Services]
 *     responses:
 *       '200':
 *         description: Berhasil
 *   post:
 *     summary: Tambah layanan
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nama_layanan:
 *                 type: string
 *               harga:
 *                 type: integer
 *               deskripsi:
 *                 type: string
 *               durasi:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '201':
 *         description: Berhasil ditambah
 */
router.get("/", serviceController.getAllServices);
router.post(
  "/",
  verifyToken,
  isAdmin,
  upload.single("image"),
  serviceController.createService,
);

/**
 * @swagger
 * /services/{id}:
 *   put:
 *     summary: Edit layanan (Bisa update foto)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nama_layanan:
 *                 type: string
 *               harga:
 *                 type: integer
 *               deskripsi:
 *                 type: string
 *               durasi:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Berhasil diupdate
 *   delete:
 *     summary: Hapus layanan
 *     tags: [Services]
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
 *         description: Berhasil dihapus
 */
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.single("image"),
  serviceController.updateService,
);
router.delete("/:id", verifyToken, isAdmin, serviceController.deleteService);

module.exports = router;
