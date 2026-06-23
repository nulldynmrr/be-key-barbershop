const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = require("../app");
const prisma = require("../config/prisma");

/**
 * Fix 1: POST /ai-config/feature-pricing — endpoint create yang sebelumnya tidak ada.
 * Setup defensif (delete-then-create) karena tabel FeaturePricing dipakai bersama oleh
 * test file lain yang masing-masing wipe+reseed tabel ini di beforeAll-nya sendiri.
 */
describe("Fix 1: POST /ai-config/feature-pricing", () => {
  let adminToken, userToken, adminId, userId;
  const SECRET = process.env.JWT_SECRET || "secret";

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: ["admin_fp@test.com", "user_fp@test.com"] } } });

    const salt = await bcrypt.genSalt(10);
    const admin = await prisma.user.create({
      data: { nama: "Admin FP", email: "admin_fp@test.com", password: await bcrypt.hash("admin123", salt), role: "admin", sisa_credit: 0 },
    });
    adminId = admin.id;
    adminToken = jwt.sign({ id: admin.id, role: "admin" }, SECRET, { expiresIn: "1d" });

    const user = await prisma.user.create({
      data: { nama: "User FP", email: "user_fp@test.com", password: await bcrypt.hash("user123", salt), role: "user", sisa_credit: 0 },
    });
    userId = user.id;
    userToken = jwt.sign({ id: user.id, role: "user" }, SECRET, { expiresIn: "1d" });

    // Pastikan TREND_ANALYSIS belum ada (dipakai untuk uji jalur sukses)
    await prisma.featurePricing.deleteMany({ where: { featureCode: "TREND_ANALYSIS" } });
    // Pastikan STANDARD_SCAN ADA (dipakai untuk uji duplikat)
    await prisma.featurePricing.upsert({
      where: { featureCode: "STANDARD_SCAN" },
      update: {},
      create: { featureCode: "STANDARD_SCAN", namaFitur: "Standard Face Scan", koinCost: 0, isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("201 saat admin membuat FeaturePricing untuk code yang valid & belum ada", async () => {
    const res = await request(app)
      .post("/api/v1/ai-config/feature-pricing")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featureCode: "TREND_ANALYSIS", namaFitur: "Trend Analysis", koinCost: 5 });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.featureCode).toBe("TREND_ANALYSIS");
    expect(res.body.data.koinCost).toBe(5);
  });

  it("400 saat featureCode duplikat", async () => {
    const res = await request(app)
      .post("/api/v1/ai-config/feature-pricing")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featureCode: "STANDARD_SCAN", namaFitur: "dupe", koinCost: 1 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).not.toMatch(/P2002/);
  });

  it("400 saat featureCode di luar FEATURE_GATE_MAP", async () => {
    const res = await request(app)
      .post("/api/v1/ai-config/feature-pricing")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featureCode: "SUPER_POWER", namaFitur: "x", koinCost: 1 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("tidak dikenal");
  });

  it("403 saat non-admin mencoba membuat FeaturePricing", async () => {
    await prisma.featurePricing.deleteMany({ where: { featureCode: "HISTORY" } });

    const res = await request(app)
      .post("/api/v1/ai-config/feature-pricing")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ featureCode: "HISTORY", namaFitur: "x", koinCost: 1 });

    expect(res.statusCode).toBe(403);
  });

  it("201 saat koinCost = 0 (fitur gratis)", async () => {
    await prisma.featurePricing.deleteMany({ where: { featureCode: "HISTORY" } });

    const res = await request(app)
      .post("/api/v1/ai-config/feature-pricing")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ featureCode: "HISTORY", namaFitur: "Extended History", koinCost: 0 });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.koinCost).toBe(0);
  });
});
