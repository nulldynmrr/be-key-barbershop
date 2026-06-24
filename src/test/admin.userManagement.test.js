const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = require("../app");
const prisma = require("../config/prisma");

describe("Admin: User & Subscription Management", () => {
  let adminToken, adminId, userToken, targetUserId;
  let idPaketAum, idPaketAumKedua, idPaketAumNonaktif;
  const SECRET = process.env.JWT_SECRET || "secret";

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: ["admin_aum@test.com", "user_aum@test.com", "target_aum@test.com"] } } });
    await prisma.subscriptionPackage.deleteMany({ where: { namaPaket: { in: ["AUM Aktif", "AUM Aktif Kedua", "AUM Nonaktif"] } } });

    const salt = await bcrypt.genSalt(10);

    const admin = await prisma.user.create({
      data: { nama: "Admin AUM", email: "admin_aum@test.com", password: await bcrypt.hash("admin123", salt), role: "admin", sisa_credit: 0 },
    });
    adminId = admin.id;
    adminToken = jwt.sign({ id: admin.id, role: "admin" }, SECRET, { expiresIn: "1d" });

    const nonAdminUser = await prisma.user.create({
      data: { nama: "User AUM", email: "user_aum@test.com", password: await bcrypt.hash("user123", salt), role: "user", sisa_credit: 0 },
    });
    userToken = jwt.sign({ id: nonAdminUser.id, role: "user" }, SECRET, { expiresIn: "1d" });

    const { encrypt } = require("../utils/encryption");
    const llmModel = await prisma.aiModel.create({
      data: {
        namaRouter: "AUM Test LLM", baseUrl: "https://mock-ai.com/v1", modelName: "test-model",
        apiKey: encrypt("fake-api-key"), typeAi: "LLM", pricingUnit: "TOKEN",
        hargaInput1M: 0.15, hargaOutput1M: 0.60,
        maxBudget: 100, rpmLimit: 60, avgTokensPerUse: 2000, isActive: true,
      },
    });

    const pkgAktif = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "AUM Aktif", jumlahKoin: 100, deskripsi: "Paket aktif untuk test",
        featStandardScan: true, llmModelId: llmModel.id,
        typeValue: "ONTIME", hppIdeal: 5000, hargaNominal: 15000, status: "AKTIF",
      },
    });
    idPaketAum = pkgAktif.id;

    const pkgAktifKedua = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "AUM Aktif Kedua", jumlahKoin: 30, deskripsi: "Paket aktif kedua untuk test topup silang",
        featStandardScan: true, llmModelId: llmModel.id,
        typeValue: "ONTIME", hppIdeal: 2000, hargaNominal: 6000, status: "AKTIF",
      },
    });
    idPaketAumKedua = pkgAktifKedua.id;

    const pkgNonaktif = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "AUM Nonaktif", jumlahKoin: 50, deskripsi: "Paket nonaktif untuk test",
        featStandardScan: true, llmModelId: llmModel.id,
        typeValue: "ONTIME", hppIdeal: 3000, hargaNominal: 9000, status: "NONAKTIF",
      },
    });
    idPaketAumNonaktif = pkgNonaktif.id;

    const targetUser = await prisma.user.create({
      data: {
        nama: "Target AUM", email: "target_aum@test.com", password: await bcrypt.hash("user123", salt),
        role: "user", sisa_credit: 0, active_package_id: idPaketAum,
      },
    });
    targetUserId = targetUser.id;

    await prisma.userPackageBalance.create({
      data: { user_id: targetUserId, package_id: idPaketAum, coins_purchased: 100, coins_remaining: 100 },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { user_id: targetUserId } });
    await prisma.userPackageBalance.deleteMany({ where: { user_id: targetUserId } });
    await prisma.user.update({ where: { id: targetUserId }, data: { active_package_id: null } });
    await prisma.user.delete({ where: { id: targetUserId } });
    await prisma.auditLog.deleteMany({ where: { admin_id: adminId } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.user.deleteMany({ where: { email: "user_aum@test.com" } });
    await prisma.subscriptionPackage.deleteMany({ where: { id: { in: [idPaketAum, idPaketAumKedua, idPaketAumNonaktif] } } });
    await prisma.aiModel.deleteMany({ where: { namaRouter: "AUM Test LLM" } });
  });

  it("GET /admin/users/:id menyertakan active_package, package_balances, transactions, dan _count", async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${targetUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.active_package).toMatchObject({ id: idPaketAum, namaPaket: "AUM Aktif" });
    expect(res.body.data.package_balances).toHaveLength(1);
    expect(res.body.data.package_balances[0].package).toMatchObject({ namaPaket: "AUM Aktif", jumlahKoin: 100 });
    expect(Array.isArray(res.body.data.transactions)).toBe(true);
    expect(res.body.data._count.package_balances).toBe(1);
  });

  it("PATCH /admin/users/:id/credit menyertakan reason di audit log", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${targetUserId}/credit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 10, reason: "Kompensasi error sistem" });

    expect(res.statusCode).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { admin_id: adminId, action: "ADJUST_CREDIT", target: targetUserId },
      orderBy: { created_at: "desc" },
    });
    expect(log.details.reason).toBe("Kompensasi error sistem");
  });

  it("POST /admin/users/:id/topup-package mengkredit koin dan auto-activate jika belum ada paket aktif", async () => {
    await prisma.user.update({ where: { id: targetUserId }, data: { active_package_id: null } });
    await prisma.userPackageBalance.deleteMany({ where: { user_id: targetUserId } });

    const res = await request(app)
      .post(`/api/v1/admin/users/${targetUserId}/topup-package`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ packageId: idPaketAum });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.active_package_id).toBe(idPaketAum);

    const balance = await prisma.userPackageBalance.findUnique({
      where: { user_id_package_id: { user_id: targetUserId, package_id: idPaketAum } },
    });
    expect(balance.coins_remaining).toBe(100);
  });

  it("POST /admin/users/:id/topup-package TIDAK mengubah active_package_id jika paket aktif masih ada saldo", async () => {
    // Arrange: target sudah aktif di idPaketAum dengan saldo > 0 (dari test sebelumnya)
    await prisma.user.update({ where: { id: targetUserId }, data: { active_package_id: idPaketAum } });

    const res = await request(app)
      .post(`/api/v1/admin/users/${targetUserId}/topup-package`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ packageId: idPaketAumKedua });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.active_package_id).toBe(idPaketAum); // tidak berubah

    const balanceKedua = await prisma.userPackageBalance.findUnique({
      where: { user_id_package_id: { user_id: targetUserId, package_id: idPaketAumKedua } },
    });
    expect(balanceKedua.coins_remaining).toBe(30); // tetap dikreditkan
  });

  it("POST /admin/users/:id/topup-package ditolak 400 untuk paket NONAKTIF", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${targetUserId}/topup-package`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ packageId: idPaketAumNonaktif });

    expect(res.statusCode).toBe(400);
  });

  it("POST /admin/users/:id/topup-package ditolak 403 untuk non-admin", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${targetUserId}/topup-package`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ packageId: idPaketAum });

    expect(res.statusCode).toBe(403);
  });
});
