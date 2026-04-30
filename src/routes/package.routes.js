const { Router } = require("express");
const {
  getActivePackages,
  createPackage,
  updatePackage,
  deletePackage,
  getLiveHPP,
} = require("../controllers/package.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

const router = Router();

/**
 * @swagger
 * /api/v1/packages/calculate-hpp:
 *   post:
 *     summary: Hitung HPP Ideal secara live (Kalkulator Admin)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil menghitung estimasi HPP
 */
router.post("/calculate-hpp", verifyToken, isAdmin, getLiveHPP);

/**
 * @swagger
 * /api/v1/packages:
 *   get:
 *     summary: Ambil pricelist aktif (Koin & Langganan)
 *     tags: [Pricing & Packages]
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar harga
 */
router.get("/", getActivePackages);

/**
 * @swagger
 * /api/v1/packages:
 *   post:
 *     summary: Buat paket harga baru (Admin Only)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Paket berhasil dibuat
 *       400:
 *         description: Validasi gagal (misal Harga Nominal < HPP Ideal)
 */
router.post("/", verifyToken, isAdmin, createPackage);

/**
 * @swagger
 * /api/v1/packages/{id}:
 *   put:
 *     summary: Update paket / Aktifkan Promo (Admin)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Update berhasil
 */
router.put("/:id", verifyToken, isAdmin, updatePackage);

/**
 * @swagger
 * /api/v1/packages/{id}:
 *   delete:
 *     summary: Hapus paket harga (Admin)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Paket dihapus
 */
router.delete("/:id", verifyToken, isAdmin, deletePackage);

module.exports = router;
