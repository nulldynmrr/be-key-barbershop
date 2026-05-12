const request = require("supertest");
const app = require("../app");
const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("axios");

const prisma = require("../config/prisma");

// Helper: Mock AI response
const mockAiSuccess = (tokens = { prompt_tokens: 2000, completion_tokens: 1000, total_tokens: 3000 }) => {
  axios.post.mockResolvedValue({
    data: {
      choices: [{ message: { content: JSON.stringify({
        kualitas_foto_ok: true, alasan_kualitas: null, jumlah_wajah: 1,
        gender: "Pria", status_rambut: "Normal", bentuk_wajah: "Oval",
        deskripsi_bentuk_wajah: "Oval proporsional", jenis_rambut: "Lurus",
        ketebalan_rambut: "Tebal", ai_confidence: 92, instruksi_barber: "Potong fade",
        rekomendasi_gaya: [{ nama_gaya: "Textured Crop", alasan: "Cocok oval", match_score: 95 }],
        catatan_stylist: "Wajah Anda cocok dengan banyak gaya."
      }) } }],
      usage: tokens,
    },
  });
};

const mockAiFail = () => {
  axios.post.mockRejectedValue(new Error("AI Provider timeout"));
};

describe("ANTI-BONCOS FULL TEST SUITE", () => {
  let adminToken, userToken, userId, adminId;
  let idPaketBasic, idPaketPremium;
  const SECRET = process.env.JWT_SECRET || "secret";
  const fakeImage = Buffer.from("fake-image-data-for-testing");

  // ─── SETUP ──────────────────────────────────────────
  beforeAll(async () => {
    await prisma.systemApiLog.deleteMany();
    await prisma.aIGeneration.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany({ where: { email: { in: ["admin_ab@test.com", "user_ab@test.com"] } } });
    await prisma.featurePricing.deleteMany();
    await prisma.subscriptionPackage.deleteMany();
    await prisma.aiModel.deleteMany();
    await prisma.systemConfig.deleteMany();

    // System Config
    await prisma.systemConfig.create({
      data: { globalMultiplier: 1.35, baseRateUsdIdr: 16000, inflationBuffer: 0.05 },
    });

    // AI Model LLM
    const { encrypt } = require("../utils/encryption");
    await prisma.aiModel.create({
      data: {
        namaRouter: "Test LLM", baseUrl: "https://mock-ai.com/v1", modelName: "test-model",
        apiKey: encrypt("fake-api-key"), typeAi: "LLM", pricingUnit: "TOKEN",
        hargaInput1M: 0.15, hargaOutput1M: 0.60,
        maxBudget: 100, rpmLimit: 60, avgTokensPerUse: 2000, isActive: true,
      },
    });

    // Feature Pricing — 10 fitur
    const features = [
      { featureCode: "STANDARD_SCAN", namaFitur: "Standard Face Scan", koinCost: 0, isActive: true },
      { featureCode: "FACE_HEATMAP", namaFitur: "Face Heatmap", koinCost: 3, isActive: true },
      { featureCode: "SYMMETRY", namaFitur: "Symmetry Scoring", koinCost: 5, isActive: true },
      { featureCode: "ADV_MAPPING", namaFitur: "Advanced Mapping", koinCost: 8, isActive: true },
      { featureCode: "HAIR_ANALYSIS", namaFitur: "Hair Analysis", koinCost: 5, isActive: true },
      { featureCode: "RISK_ANALYSIS", namaFitur: "Risk Analysis", koinCost: 3, isActive: true },
      { featureCode: "BARBER_INSTRUCTIONS", namaFitur: "Barber Instructions", koinCost: 2, isActive: true },
      { featureCode: "VIRTUAL_TRY_ON", namaFitur: "Virtual Try-On", koinCost: 10, isActive: true },
      { featureCode: "HISTORY", namaFitur: "Extended History", koinCost: 1, isActive: true },
      { featureCode: "TREND_ANALYSIS", namaFitur: "Trend Analysis", koinCost: 5, isActive: true },
    ];
    await prisma.featurePricing.createMany({ data: features });

    const salt = await bcrypt.genSalt(10);

    // Admin
    const admin = await prisma.user.create({
      data: { nama: "Admin AB", email: "admin_ab@test.com", password: await bcrypt.hash("admin123", salt), role: "admin", sisa_credit: 999 },
    });
    adminId = admin.id;
    adminToken = jwt.sign({ id: admin.id, role: "admin" }, SECRET, { expiresIn: "1d" });

    // Paket Basic (hanya STANDARD_SCAN)
    const basic = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "Basic", jumlahKoin: 100, deskripsi: "Paket basic",
        featStandardScan: true, featFaceHeatmap: false, featSymmetry: false, featAdvMapping: false,
        featHairAnalysis: false, featRiskAnalysis: false, featBarberInstructions: false,
        featVirtualTryOn: false, featHistory: false, featTrendAnalysis: false,
        typeValue: "ONTIME", hppIdeal: 5000, hargaNominal: 25000, status: "AKTIF",
      },
    });
    idPaketBasic = basic.id;

    // Paket Premium (semua fitur ON)
    const premium = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "Premium All", jumlahKoin: 500, deskripsi: "Paket lengkap",
        featStandardScan: true, featFaceHeatmap: true, featSymmetry: true, featAdvMapping: true,
        featHairAnalysis: true, featRiskAnalysis: true, featBarberInstructions: true,
        featVirtualTryOn: true, featHistory: true, featTrendAnalysis: true,
        typeValue: "SUBSCRIPTION", durationDays: 30, hppIdeal: 45000, hargaNominal: 99000, status: "AKTIF",
      },
    });
    idPaketPremium = premium.id;

    // User dengan paket Basic
    const user = await prisma.user.create({
      data: {
        nama: "User AB", email: "user_ab@test.com", password: await bcrypt.hash("user123", salt),
        role: "user", sisa_credit: 200, active_package_id: idPaketBasic,
      },
    });
    userId = user.id;
    userToken = jwt.sign({ id: user.id, role: "user" }, SECRET, { expiresIn: "1d" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── TEST 1: FEATURE GATE — Paket Basic ditolak fitur premium ──
  describe("1. FEATURE GATE: Paket Basic tidak bisa akses fitur premium", () => {
    it("403 ketika request SYMMETRY dengan paket Basic", async () => {
      mockAiSuccess();
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN", "SYMMETRY"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("SYMMETRY");
      expect(res.body.message).toContain("tidak termasuk dalam paket");
    });

    it("403 ketika request VIRTUAL_TRY_ON dengan paket Basic", async () => {
      mockAiSuccess();
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["VIRTUAL_TRY_ON"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("VIRTUAL_TRY_ON");
    });
  });

  // ─── TEST 2: FEATURE GATE — Paket Premium bisa akses semua ──
  describe("2. FEATURE GATE: Paket Premium bisa akses semua fitur", () => {
    beforeAll(async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { active_package_id: idPaketPremium, sisa_credit: 500 },
      });
    });

    it("200 ketika request SYMMETRY + ADV_MAPPING dengan paket Premium", async () => {
      mockAiSuccess();
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN", "SYMMETRY", "ADV_MAPPING"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(200);
      expect(res.body.data.active_features).toContain("SYMMETRY");
      expect(res.body.data.active_features).toContain("ADV_MAPPING");
    });
  });

  // ─── TEST 3: DUPLICATE PREVENTION (Cooldown 5 detik) ──
  describe("3. DUPLICATE PREVENTION: Spam click diblokir", () => {
    it("429 ketika request kedua dalam 5 detik", async () => {
      mockAiSuccess();

      // Request pertama harus sukses
      const res1 = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res1.statusCode).toBe(200);

      // Request kedua langsung → harus 429
      const res2 = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]))
        .attach("foto", fakeImage, "wajah2.jpg");

      expect(res2.statusCode).toBe(429);
      expect(res2.body.message).toContain("Terlalu cepat");
    });
  });

  // ─── TEST 4: KREDIT TIDAK CUKUP ──
  describe("4. KREDIT TIDAK CUKUP: User ditolak jika saldo habis", () => {
    it("402 ketika sisa_credit kurang dari estimasi", async () => {
      await prisma.user.update({ where: { id: userId }, data: { sisa_credit: 1 } });

      // Tunggu cooldown lewat
      await new Promise((r) => setTimeout(r, 5500));

      mockAiSuccess();
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(402);
      expect(res.body.message).toContain("Credit tidak mencukupi");

      // Restore credit
      await prisma.user.update({ where: { id: userId }, data: { sisa_credit: 500 } });
    });
  });

  // ─── TEST 5: TANPA PAKET AKTIF ──
  describe("5. TANPA PAKET: User tanpa paket ditolak", () => {
    it("403 ketika user tidak punya active_package", async () => {
      await prisma.user.update({ where: { id: userId }, data: { active_package_id: null } });
      await new Promise((r) => setTimeout(r, 5500));

      mockAiSuccess();
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("belum memiliki paket");

      // Restore
      await prisma.user.update({ where: { id: userId }, data: { active_package_id: idPaketPremium } });
    });
  });

  // ─── TEST 6: ADMIN TOGGLE FITUR OFF → User skip fitur ──
  describe("6. ADMIN TOGGLE OFF: Fitur yang di-OFF oleh admin di-skip", () => {
    it("Fitur SYMMETRY di-OFF global → tidak muncul di active_features", async () => {
      const symFeature = await prisma.featurePricing.findUnique({ where: { featureCode: "SYMMETRY" } });
      await prisma.featurePricing.update({ where: { id: symFeature.id }, data: { isActive: false } });

      await new Promise((r) => setTimeout(r, 5500));
      mockAiSuccess();

      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN", "SYMMETRY"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(200);
      expect(res.body.data.active_features).not.toContain("SYMMETRY");

      // Restore
      await prisma.featurePricing.update({ where: { id: symFeature.id }, data: { isActive: true } });
    });
  });

  // ─── TEST 7: RETRY LIMIT — AI gagal 3x → 503 ──
  describe("7. RETRY LIMIT: AI gagal 3x → 503 + alert", () => {
    it("503 setelah 3x retry timeout", async () => {
      await new Promise((r) => setTimeout(r, 5500));
      mockAiFail();

      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(503);
      expect(res.body.message).toContain("gagal merespons");
      expect(axios.post).toHaveBeenCalledTimes(3); // 3x retry
    }, 60000);
  });

  // ─── TEST 8: FITUR TIDAK DIKENAL → 400 ──
  describe("8. FITUR TIDAK DIKENAL: Request fitur random → 400", () => {
    it("400 ketika request fitur 'SUPER_POWER'", async () => {
      await new Promise((r) => setTimeout(r, 5500));
      mockAiSuccess();

      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["SUPER_POWER"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("tidak dikenal");
    });
  });

  // ─── TEST 9: TANPA FOTO → 400 ──
  describe("9. TANPA FOTO: Request tanpa upload → 400", () => {
    it("400 ketika tidak ada file foto", async () => {
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]));

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("unggah foto");
    });
  });

  // ─── TEST 10: GET /features — Cek feature availability ──
  describe("10. GET /features: User melihat status fitur", () => {
    it("Menampilkan globallyActive + inPackage + available", async () => {
      await prisma.user.update({ where: { id: userId }, data: { active_package_id: idPaketBasic } });

      const res = await request(app)
        .get("/api/v1/ai/features")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      const data = res.body.data;

      // STANDARD_SCAN: globally ON + in Basic = available
      expect(data.STANDARD_SCAN.globallyActive).toBe(true);
      expect(data.STANDARD_SCAN.inPackage).toBe(true);
      expect(data.STANDARD_SCAN.available).toBe(true);

      // SYMMETRY: globally ON + NOT in Basic = not available
      expect(data.SYMMETRY.globallyActive).toBe(true);
      expect(data.SYMMETRY.inPackage).toBe(false);
      expect(data.SYMMETRY.available).toBe(false);

      // Restore
      await prisma.user.update({ where: { id: userId }, data: { active_package_id: idPaketPremium } });
    });
  });

  // ─── TEST 11: GET /feature-toggle — Admin only ──
  describe("11. GET /feature-toggle: Hanya admin", () => {
    it("Admin mendapat map toggle semua fitur", async () => {
      const res = await request(app)
        .get("/api/v1/ai-config/feature-toggle")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty("STANDARD_SCAN");
      expect(res.body.data).toHaveProperty("FACE_HEATMAP");
      expect(res.body.data).toHaveProperty("HAIR_ANALYSIS");
      expect(res.body.data.STANDARD_SCAN).toHaveProperty("isActive");
    });

    it("User biasa ditolak akses feature-toggle", async () => {
      const res = await request(app)
        .get("/api/v1/ai-config/feature-toggle")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── TEST 12: TANPA TOKEN AUTH → 401 ──
  describe("12. TANPA AUTH: Request tanpa token → 401", () => {
    it("401 ketika tidak ada Bearer token", async () => {
      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .field("requestedFeatures", JSON.stringify(["STANDARD_SCAN"]))
        .attach("foto", fakeImage, "wajah.jpg");

      expect(res.statusCode).toBe(401);
    });
  });
});
