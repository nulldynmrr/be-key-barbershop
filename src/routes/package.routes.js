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
 * /v1/packages/calculate-hpp:
 *   post:
 *     summary: Hitung HPP Ideal secara live (Kalkulator Admin)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jumlahKoin:
 *                 type: integer
 *                 example: 100
 *               featVirtualTryOn:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Berhasil menghitung estimasi HPP
 */
router.post("/calculate-hpp", verifyToken, isAdmin, getLiveHPP);

/**
 * @swagger
 * /v1/packages:
 *   get:
 *     summary: Ambil pricelist aktif (Koin & Langganan)
 *     tags: [Pricing & Packages]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar harga
 */
router.get("/", getActivePackages);

/**
 * @swagger
 * /v1/packages:
 *   post:
 *     summary: Buat paket harga baru (Admin Only)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [namaPaket, typeValue, hppIdeal, hargaNominal]
 *             properties:
 *               namaPaket:        { type: string,  example: "Starter Pack" }
 *               deskripsi:        { type: string,  example: "Paket hemat untuk analisis dasar." }
 *               typeValue:        { type: string,  enum: [ONTIME, SUBSCRIPTION], example: "ONTIME" }
 *               jumlahKoin:       { type: integer, example: 100 }
 *               featStandardScan: { type: boolean, example: true }
 *               featSymmetry:     { type: boolean, example: false }
 *               featAdvMapping:   { type: boolean, example: false }
 *               featVirtualTryOn: { type: boolean, example: false }
 *               featHistory:      { type: boolean, example: false }
 *               hppIdeal:         { type: number,  example: 12400 }
 *               hargaNominal:     { type: number,  example: 25000 }
 *               promoAktif:       { type: boolean, example: false }
 *     responses:
 *       201:
 *         description: Paket berhasil dibuat
 *       400:
 *         description: Validasi gagal
 */
router.post("/", verifyToken, isAdmin, createPackage);

/**
 * @swagger
 * /v1/packages/{id}:
 *   put:
 *     summary: Update paket / Aktifkan Promo (Admin)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namaPaket:    { type: string,  example: "Premium Pack" }
 *               hargaNominal: { type: number,  example: 50000 }
 *               promoAktif:   { type: boolean, example: true }
 *               hargaDiskon:  { type: number,  example: 45000 }
 *               hppIdeal:     { type: number,  example: 20000 }
 *     responses:
 *       200:
 *         description: Update berhasil
 */
router.put("/:id", verifyToken, isAdmin, updatePackage);

/**
 * @swagger
 * /v1/packages/{id}:
 *   delete:
 *     summary: Hapus paket harga (Admin)
 *     tags: [Pricing & Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paket dihapus
 */
router.delete("/:id", verifyToken, isAdmin, deletePackage);

module.exports = router;
