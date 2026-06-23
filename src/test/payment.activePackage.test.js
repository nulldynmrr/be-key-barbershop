const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = require("../app");
const prisma = require("../config/prisma");

/**
 * Fix 2: payment.controller.js (buyPackage/paymentNotification/paymentCallback) tidak boleh
 * lagi menimpa active_package_id user secara tidak bersyarat setiap ada pembelian — hanya
 * boleh auto-aktifkan paket baru kalau paket aktif user saat ini sudah tidak punya saldo.
 * Test ini memanggil endpoint HTTP asli (bukan manipulasi Prisma langsung di test), karena
 * itu justru gap yang dulu membuat bug ini lolos tanpa terdeteksi.
 */
describe("Fix 2: active_package_id tidak ter-overwrite saat beli paket lain", () => {
  let userToken, userId;
  let idPaketMahal, idPaketMurah;
  const SECRET = process.env.JWT_SECRET || "secret";

  beforeAll(async () => {
    await prisma.transaction.deleteMany({ where: { user: { email: "user_apb@test.com" } } });
    await prisma.userPackageBalance.deleteMany({ where: { user: { email: "user_apb@test.com" } } });
    await prisma.user.updateMany({
      where: { email: "user_apb@test.com" },
      data: { active_package_id: null },
    });
    await prisma.user.deleteMany({ where: { email: "user_apb@test.com" } });
    await prisma.subscriptionPackage.deleteMany({ where: { namaPaket: { in: ["APB Mahal", "APB Murah"] } } });

    const mahal = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "APB Mahal", jumlahKoin: 500, deskripsi: "Paket mahal",
        featStandardScan: true, featSymmetry: true, featAdvMapping: true,
        typeValue: "SUBSCRIPTION", durationDays: 30, hppIdeal: 45000, hargaNominal: 99000, status: "AKTIF",
      },
    });
    idPaketMahal = mahal.id;

    const murah = await prisma.subscriptionPackage.create({
      data: {
        namaPaket: "APB Murah", jumlahKoin: 50, deskripsi: "Paket murah",
        featStandardScan: true,
        typeValue: "ONTIME", hppIdeal: 5000, hargaNominal: 15000, status: "AKTIF",
      },
    });
    idPaketMurah = murah.id;

    const salt = await bcrypt.genSalt(10);
    const user = await prisma.user.create({
      data: { nama: "User APB", email: "user_apb@test.com", password: await bcrypt.hash("user123", salt), role: "user", sisa_credit: 0 },
    });
    userId = user.id;
    userToken = jwt.sign({ id: user.id, role: "user" }, SECRET, { expiresIn: "1d" });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { user_id: userId } });
    await prisma.userPackageBalance.deleteMany({ where: { user_id: userId } });
    await prisma.user.update({ where: { id: userId }, data: { active_package_id: null } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.subscriptionPackage.deleteMany({ where: { id: { in: [idPaketMahal, idPaketMurah] } } });
  });

  it("MENGAKTIFKAN paket baru jika user belum punya active_package_id sama sekali", async () => {
    await prisma.user.update({ where: { id: userId }, data: { active_package_id: null } });

    const res = await request(app)
      .post("/api/v1/payments/buy-package")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ package_id: idPaketMahal });

    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.active_package_id).toBe(idPaketMahal);
  });

  it("TIDAK mengubah active_package_id jika paket aktif masih ada saldo", async () => {
    // Arrange: pastikan paket aktif (Mahal) masih punya saldo > 0
    await prisma.userPackageBalance.upsert({
      where: { user_id_package_id: { user_id: userId, package_id: idPaketMahal } },
      update: { coins_remaining: 500 },
      create: { user_id: userId, package_id: idPaketMahal, coins_purchased: 500, coins_remaining: 500 },
    });
    await prisma.user.update({ where: { id: userId }, data: { active_package_id: idPaketMahal } });

    const res = await request(app)
      .post("/api/v1/payments/buy-package")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ package_id: idPaketMurah });

    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.active_package_id).toBe(idPaketMahal); // unchanged

    const balanceMurah = await prisma.userPackageBalance.findUnique({
      where: { user_id_package_id: { user_id: userId, package_id: idPaketMurah } },
    });
    expect(balanceMurah.coins_remaining).toBeGreaterThan(0); // tetap dikreditkan
  });

  it("MENGUBAH active_package_id jika paket aktif sudah habis saldonya", async () => {
    // Arrange: habiskan saldo paket aktif (Mahal)
    await prisma.userPackageBalance.update({
      where: { user_id_package_id: { user_id: userId, package_id: idPaketMahal } },
      data: { coins_remaining: 0 },
    });
    await prisma.user.update({ where: { id: userId }, data: { active_package_id: idPaketMahal } });

    const res = await request(app)
      .post("/api/v1/payments/buy-package")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ package_id: idPaketMurah });

    expect(res.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.active_package_id).toBe(idPaketMurah); // flipped
  });
});
