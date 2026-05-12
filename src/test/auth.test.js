const request = require("supertest");
const app = require("../app");
const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken"); 

describe("Key Barber Mega-Security Test Suite", () => {
  let userToken = "";
  let adminToken = "";

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ["qatest@test.com", "admin_qa@test.com"] } },
    });

    const hashedUserPass = await bcrypt.hash("userpassword123", 10);
    const user = await prisma.user.create({
      data: {
        email: "qatest@test.com",
        nama: "QA User",
        password: hashedUserPass,
        role: "user",
      },
    });

    const hashedAdminPass = await bcrypt.hash("adminpassword123", 10);
    const admin = await prisma.user.create({
      data: {
        email: "admin_qa@test.com",
        nama: "QA Admin",
        password: hashedAdminPass,
        role: "admin",
      },
    });

    // ✅ Buat token langsung pakai JWT_SECRET yang sama dengan server
    // Tidak perlu lewat Google OAuth yang butuh token asli
    userToken = jwt.sign(
      { id: user.id, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    adminToken = jwt.sign(
      { id: admin.id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. AUTH - LOGIN SCENARIOS
  // ============================================================
  describe("Auth: Login Edge Cases", () => {
    const loginPath = "/api/v1/auth/admin/login";

    it.each([
      ["Email salah", "wrong@test.com", "adminpassword123", 403],
      ["Password salah", "admin_qa@test.com", "salah_pass", 401],
      ["Email kosong", "", "adminpassword123", 400],
      ["Password kosong", "admin_qa@test.com", "", 400],
      ["Injeksi SQL sederhana", "' OR 1=1 --", "password", 403],
      ["Password terlalu pendek", "admin_qa@test.com", "123", 401],
    ])("Case: %s", async (desc, email, password, expectedStatus) => {
      const res = await request(app).post(loginPath).send({ email, password });
      expect(res.statusCode).toEqual(expectedStatus);
    });

    it("Akun USER mencoba login di API ADMIN", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: "qatest@test.com", password: "userpassword123" });
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toMatch(/Anda bukan Admin/i);
    });
  });

  // ============================================================
  // 2. REGISTRATION ZOD STRESS TEST
  // ============================================================
  describe("Auth: Registration Zod Stress Test", () => {
    const regPath = "/api/v1/auth/user/register";

    it("Menolak nama yang terlalu panjang (>100 karakter)", async () => {
      const res = await request(app)
        .post(regPath)
        .send({
          nama: "a".repeat(101),
          email: "longname@test.com",
          password: "password123",
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toContain("Nama maksimal 100 karakter");
    });

    it("Menolak format email yang ngawur", async () => {
      const res = await request(app).post(regPath).send({
        nama: "User Test",
        email: "bukan_email.com",
        password: "password123",
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toContain("Format email tidak valid");
    });
  });

  // ============================================================
  // 3. RBAC - CROSS ROLE TEST
  // ============================================================
  describe("RBAC: Cross-Role & Permission Test", () => {
    it("User biasa dilarang keras akses dashboard admin", async () => {
      // Pakai userToken yang sudah dibuat di beforeAll
      // Tidak perlu login lagi lewat Google OAuth
      const res = await request(app)
        .get("/api/v1/dashboard/main")
        .set("Authorization", `Bearer ${userToken}`);

      // verifyToken → OK (token valid)
      // isAdmin → REJECT karena role "user" bukan "admin" → 403
      expect(res.statusCode).toEqual(403);
    });

    it("Akses dengan Token yang dimanipulasi (Tampered Token)", async () => {
      const tamperedToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.HACKED_PAYLOAD.SIGNATURE";
      const res = await request(app)
        .get("/api/v1/dashboard/main")
        .set("Authorization", `Bearer ${tamperedToken}`);
      expect(res.statusCode).toEqual(401);
    });
  });

  // ============================================================
  // 4. FORGOT PASSWORD
  // ============================================================
  describe("Auth: Forgot Password Scenarios (Expected)", () => {
    it("Lupa password dengan email yang tidak terdaftar", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "alien@mars.com" });
      expect(res.statusCode).toEqual(200);
    });
  });

  // ============================================================
  // 5. PAYLOAD ATTACK
  // ============================================================
  describe("System: Payload Attack", () => {
    it("Menolak Request Body yang terlalu besar (Flood Attack)", async () => {
      const bigData = { data: "x".repeat(1000000) };
      const res = await request(app)
        .post("/api/v1/auth/user/register")
        .send(bigData);
      expect(res.statusCode).not.toEqual(201);
    });
  });
});
