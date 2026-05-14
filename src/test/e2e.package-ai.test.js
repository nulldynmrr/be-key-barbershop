const request = require("supertest");
const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("axios");

const lcInvoke = { fn: null };
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: (...args) => {
        if (!lcInvoke.fn) throw new Error("lcInvoke.fn belum di-set");
        return lcInvoke.fn(...args);
      },
    }),
  })),
}));

jest.mock("@langchain/core/messages", () => ({
  SystemMessage: function SystemMessage(c) {
    this.content = c;
  },
  HumanMessage: function HumanMessage(f) {
    this.content = f.content;
  },
}));

const app = require("../app");
const prisma = require("../config/prisma");
const sharp = require("sharp");

let e2eJpegBuffer;

const e2eParsed = () => ({
  kualitas_foto_ok: true,
  alasan_kualitas: null,
  jumlah_wajah: 1,
  gender: "Pria",
  status_rambut: "Normal",
  bentuk_wajah: "Oval",
  deskripsi_bentuk_wajah: "Oval",
  jenis_rambut: "Lurus",
  ketebalan_rambut: "Sedang",
  ai_confidence: 90,
  instruksi_barber: "Test",
  rekomendasi_gaya: [{ nama_gaya: "Crop", alasan: "OK", match_score: 90 }],
  catatan_stylist: "OK",
});

describe("E2E Integration: Admin Configuration & User AI Usage", () => {
  let adminToken = "";
  let userToken = "";
  let userId = "";
  let featureId = "";
  let idPaketMurah = "";
  let idPaketMahal = "";

  beforeAll(async () => {
    await prisma.systemApiLog.deleteMany();
    await prisma.aIGeneration.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.user.updateMany({
      where: { active_package_id: { not: null } },
      data: { active_package_id: null },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["admin_e2e@test.com", "user_e2e@test.com"] } },
    });
    await prisma.featurePricing.deleteMany();
    await prisma.subscriptionPackage.deleteMany();
    await prisma.aiModel.deleteMany();
    await prisma.creditPackage.deleteMany();
    await prisma.systemConfig.deleteMany();

    await prisma.systemConfig.create({
      data: {
        globalMultiplier: 1.35,
        baseRateUsdIdr: 16000,
        inflationBuffer: 0.05,
      },
    });

    const salt = await bcrypt.genSalt(10);
    const hashedAdminPass = await bcrypt.hash("admin123", salt);
    const admin = await prisma.user.create({
      data: {
        nama: "Admin System",
        email: "admin_e2e@test.com",
        password: hashedAdminPass,
        role: "admin",
        sisa_credit: 999,
      },
    });

    adminToken = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" },
    );

    const hashedUserPass = await bcrypt.hash("user123", salt);
    const user = await prisma.user.create({
      data: {
        nama: "Tester E2E",
        email: "user_e2e@test.com",
        password: hashedUserPass,
        role: "user",
        sisa_credit: 0,
      },
    });

    userToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" },
    );
    userId = user.id;

    const feature = await prisma.featurePricing.create({
      data: {
        featureCode: "HAIR_ANALYSIS",
        namaFitur: "Hair Analysis",
        koinCost: 5,
        isActive: true,
      },
    });
    featureId = feature.id;

    await prisma.featurePricing.create({
      data: {
        featureCode: "STANDARD_SCAN",
        namaFitur: "Standard Face Scan",
        koinCost: 0,
        isActive: true,
      },
    });

    e2eJpegBuffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#ccc" },
    })
      .jpeg()
      .toBuffer();

    axios.post.mockResolvedValue({ data: {} });
    lcInvoke.fn = async () => ({
      parsed: e2eParsed(),
      raw: {
        usage_metadata: {
          input_tokens: 500000,
          output_tokens: 100000,
          total_tokens: 600000,
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: {} });
    lcInvoke.fn = async () => ({
      parsed: e2eParsed(),
      raw: {
        usage_metadata: {
          input_tokens: 500000,
          output_tokens: 100000,
          total_tokens: 600000,
        },
      },
    });
  });

  describe("Admin Flow: Setup Model, Pricing, & Packages", () => {
    it("Admin berhasil membuat konfigurasi Model AI", async () => {
      const res = await request(app)
        .post("/api/v1/ai-config/models")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          namaRouter: "Maia Local",
          baseUrl: "https://mock-ai.com/v1",
          modelName: "maia-7b",
          apiKey: "api-key-bodongan",
          typeAi: "LLM",
          hargaInput1M: 0.15,
          hargaOutput1M: 0.6,
          maxBudget: 100.0,
          rpmLimit: 60,
          avgTokensPerUse: 2000,
          isActive: true,
        });

      expect(res.statusCode).toEqual(200);
    });

    it("Admin berhasil memperbarui harga Service Fitur AI", async () => {
      const res = await request(app)
        .put(`/api/v1/ai-config/feature-pricing/${featureId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ koinCost: 5, isActive: true });

      expect(res.statusCode).toEqual(200);
    });

    it("Admin berhasil membuat 2 Subscription Package (Murah & Mahal)", async () => {
      const paketMurah = await prisma.subscriptionPackage.create({
        data: {
          namaPaket: "Starter Pack",
          jumlahKoin: 100,
          deskripsi: "Paket hemat untuk memulai",
          featStandardScan: true,
          featHairAnalysis: true,
          featVirtualTryOn: false,
          typeValue: "ONTIME",
          hppIdeal: 12400.0,
          hargaNominal: 25000.0,
          promoAktif: false,
          status: "AKTIF",
        },
      });

      const paketMahal = await prisma.subscriptionPackage.create({
        data: {
          namaPaket: "Pro Premium",
          jumlahKoin: 500,
          deskripsi: "Paket lengkap",
          featStandardScan: true,
          featVirtualTryOn: true,
          typeValue: "SUBSCRIPTION",
          durationDays: 30,
          hppIdeal: 45000.0,
          hargaNominal: 99000.0,
          promoAktif: true,
          hargaDiskon: 89000.0,
          status: "AKTIF",
        },
      });

      idPaketMurah = paketMurah.id;
      idPaketMahal = paketMahal.id;
      expect(idPaketMurah).toBeDefined();
    });
  });

  describe("User Flow: Package Purchase & AI Analysis (Token Fee)", () => {
    it("User memilih dan membeli Paket Murah (Transaksi tercatat di DB)", async () => {
      const paketDibeli = await prisma.subscriptionPackage.findUnique({
        where: { id: idPaketMurah },
      });

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { active_package_id: idPaketMurah, sisa_credit: { increment: paketDibeli.jumlahKoin } },
        });

        await tx.transaction.create({
          data: {
            user_id: userId,
            jenis_transaksi: "PURCHASE_PACKAGE",
            nominal: paketDibeli.hargaNominal,
            status: "SUCCESS",
          },
        });
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(updatedUser.sisa_credit).toEqual(100);
    });

    it("User berhasil memotong 17 Koin (5 Koin Fitur + 12 Koin Real Token LLM)", async () => {
      const fakeImageBuffer = e2eJpegBuffer;

      const res = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["HAIR_ANALYSIS"]))
        .attach("foto", fakeImageBuffer, "wajah.jpg");

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain("17 koin terpotong");

      const userDb = await prisma.user.findUnique({ where: { id: userId } });
      expect(userDb.sisa_credit).toEqual(83);
    });

    it("User ditolak menggunakan AI karena sisa Koin kalah dengan estimasi", async () => {
      await new Promise((r) => setTimeout(r, 5500));

      await prisma.user.update({
        where: { id: userId },
        data: { sisa_credit: 2 },
      });

      const fakeImageBuffer = e2eJpegBuffer;
      const resNolak = await request(app)
        .post("/api/v1/ai/analyze-face")
        .set("Authorization", `Bearer ${userToken}`)
        .field("requestedFeatures", JSON.stringify(["HAIR_ANALYSIS"]))
        .attach("foto", fakeImageBuffer, "wajah3.jpg");

      expect(resNolak.statusCode).toEqual(402);
      expect(resNolak.body.message).toContain("Estimasi butuh");
    });
  });
});
