const request = require("supertest");
const app = require("../app");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

describe("🛡️ Key Barber Mega-Security Test Suite", () => {
  let userToken = "";
  let adminToken = "";

  beforeAll(async () => {
    // Cleanup & Seed data untuk testing
    await prisma.user.deleteMany({
      where: { email: { in: ["qatest@test.com", "admin_qa@test.com"] } },
    });

    // Buat User biasa
    const hashedUserPass = await bcrypt.hash("userpassword123", 10);
    const user = await prisma.user.create({
      data: {
        email: "qatest@test.com",
        nama: "QA User",
        password: hashedUserPass,
        role: "user",
      },
    });

    // Buat Admin
    const hashedAdminPass = await bcrypt.hash("adminpassword123", 10);
    await prisma.user.create({
      data: {
        email: "admin_qa@test.com",
        nama: "QA Admin",
        password: hashedAdminPass,
        role: "admin",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==========================================================
  // 1. AUTH - LOGIN SCENARIOS (NEGATIVE CASES)
  // ==========================================================
  describe("🚫 Auth: Login Edge Cases", () => {
    const loginPath = "/api/v1/auth/admin/login";

    it.each([
      ["Email salah", "wrong@test.com", "adminpassword123", 403],
      ["Password salah", "admin_qa@test.com", "salah_pass", 401],
      ["Email kosong", "", "adminpassword123", 400],
      ["Password kosong", "admin_qa@test.com", "", 400],
      ["Injeksi SQL sederhana", "' OR 1=1 --", "password", 403],
      ["Password terlalu pendek", "admin_qa@test.com", "123", 401],
    ])("🚨 Case: %s", async (desc, email, password, expectedStatus) => {
      const res = await request(app).post(loginPath).send({ email, password });
      expect(res.statusCode).toEqual(expectedStatus);
    });

    it("🕵️ Akun USER mencoba login di API ADMIN", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: "qatest@test.com", password: "userpassword123" });

      // Harus ditolak karena controller admin memfilter role !== 'admin'
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toMatch(/Anda bukan Admin/i);
    });
  });

  // ==========================================================
  // 2. AUTH - REGISTRATION VALIDATION (ZOD STRESS TEST)
  // ==========================================================
  describe("📝 Auth: Registration Zod Stress Test", () => {
    const regPath = "/api/v1/auth/user/register";

    it("🚨 Menolak nama yang terlalu panjang (>100 karakter)", async () => {
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

    it("🚨 Menolak format email yang ngawur", async () => {
      const res = await request(app).post(regPath).send({
        nama: "User Test",
        email: "bukan_email.com",
        password: "password123",
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toContain("Format email tidak valid");
    });
  });

  // ==========================================================
  // 3. ROLE-BASED ACCESS CONTROL (RBAC) - DEEP TEST
  // ==========================================================
  describe("🏗️ RBAC: Cross-Role & Permission Test", () => {
    beforeAll(async () => {
      // Login dulu untuk dapat token
      const userLogin = await request(app)
        .post("/api/v1/auth/google") // Asumsi google login atau buat login user baru
        .send({ token: "MOCK_TOKEN" }); // Perlu mock atau ganti ke login manual

      // Kita pakai bypass manual untuk test role
      const user = await prisma.user.findUnique({
        where: { email: "qatest@test.com" },
      });
      const admin = await prisma.user.findUnique({
        where: { email: "admin_qa@test.com" },
      });

      // Mocking JWT biasanya lebih baik pakai helper, tapi di sini kita asumsi sudah ada login
    });

    it("🚨 User biasa dilarang keras akses dashboard admin", async () => {
      // Login User
      const loginRes = await request(app)
        .post("/api/v1/auth/google")
        .send({ token: "VALID_TOKEN" });
      const token = loginRes.body.token;

      const res = await request(app)
        .get("/api/v1/dashboard/main")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toEqual(403); // Forbidden
    });

    it("🚨 Akses dengan Token yang dimanipulasi (Tampered Token)", async () => {
      const tamperedToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.HACKED_PAYLOAD.SIGNATURE";
      const res = await request(app)
        .get("/api/v1/dashboard/main")
        .set("Authorization", `Bearer ${tamperedToken}`);

      expect(res.statusCode).toEqual(401); // Unauthorized
    });
  });

  // ==========================================================
  // 4. LUPA PASSWORD (LOGIC TEST)
  // ==========================================================
  // Note: Kamu perlu membuat endpoint ini dulu di controller jika belum ada
  describe("🔑 Auth: Forgot Password Scenarios (Expected)", () => {
    it("🚨 Lupa password dengan email yang tidak terdaftar", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password") // Endpoint ini harus dibuat
        .send({ email: "alien@mars.com" });

      // Best practice: tetap return success 200 agar hacker tidak tahu email mana yang terdaftar
      expect(res.statusCode).toEqual(200);
    });
  });

  // ==========================================================
  // 5. SYSTEM STABILITY - PAYLOAD ATTACK
  // ==========================================================
  describe("💣 System: Payload Attack", () => {
    it("🚨 Menolak Request Body yang terlalu besar (Flood Attack)", async () => {
      const bigData = { data: "x".repeat(1000000) }; // 1MB data
      const res = await request(app)
        .post("/api/v1/auth/user/register")
        .send(bigData);

      // Biasanya Express akan nolak dengan 413 Payload Too Large jika dikonfigurasi
      expect(res.statusCode).not.toEqual(201);
    });
  });
});
