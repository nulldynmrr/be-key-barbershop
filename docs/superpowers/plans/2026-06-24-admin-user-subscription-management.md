# Admin User & Subscription Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a UI to view and manage user subscriptions/koin — backed by 2 new + 2 reused-with-tweak + 1 reused-unchanged backend endpoint, and 2 new admin frontend pages.

**Architecture:** Two independent repos, both already on git branch `feature/admin-user-management`. Backend tasks (1-4) live in `be-key-barbershop`. Frontend tasks (5-9) live in `fe-key-barbershop` and depend on backend tasks being done first (they call the new endpoints).

**Tech Stack:** Express + Prisma (MySQL) backend, Jest + Supertest tests (real DB, `maxWorkers: 1`). Next.js 14 App Router frontend, no test runner — verification is `npm run build` + manual dev-server check.

**Spec:** `be-key-barbershop/docs/superpowers/specs/2026-06-24-admin-user-subscription-management-design.md` — read this first for the "why" behind every decision below.

## Global Constraints

- Every mutating admin action must call the existing `createAuditLog(adminId, action, target, details, req)` helper (already defined at the top of `admin.controller.js`).
- Backend error pattern: `const error = new Error("..."); error.statusCode = 400; throw error;` then caught and passed to `sendError(res, { statusCode: error.statusCode || 500, message: error.message })`.
- Backend success pattern: `success(res, { data, message, statusCode })` from `src/utils/response.helper.js`.
- Frontend Tailwind palette (must match exactly, copied from `langganan/page.jsx`): primary text `text-[#4a1a1a]`, secondary text `text-[#8b6f66]`, headings color `text-[#2b1d19]`, borders `border-[#e6d1c7]`, hover row `hover:bg-[#fafafa]`, primary button `bg-[#4a1a1a] hover:bg-[#2b1d19]`, success badge `bg-[#bbf7d0] text-[#166534]`, danger badge `bg-[#fecaca] text-[#991b1b]`. Headings use `style={{ fontFamily: "var(--font-noto-serif)" }}`, body uses `style={{ fontFamily: "var(--font-plus-jakarta)" }}`.
- Frontend toast pattern: `const { showToast, showConfirm } = useToast();` from `@/contexts/ToastContext`. `showToast(message, type)` where type is `"success"` or `"error"`. `showConfirm(title, message, onConfirmCallback)` renders a custom confirm modal and calls `onConfirmCallback` when the user clicks confirm.
- Frontend service pattern: named export object in `src/services/<domain>Service.js`, each property an arrow function calling `api.<method>(url, ...)` from `@/utils/request` (default export `api`).
- All new backend test assertions go in one new file: `src/test/admin.userManagement.test.js`, growing across Tasks 1-4 (one shared `beforeAll`/`afterAll` fixture, reused across tasks — see Task 1 for the full fixture).

---

## Task 1: Extend `getUserDetail` with package & transaction data

**Files:**
- Modify: `be-key-barbershop/src/controllers/admin.controller.js` (the `getUserDetail` function)
- Create: `be-key-barbershop/src/test/admin.userManagement.test.js`

**Interfaces:**
- Produces: `GET /api/v1/admin/users/:id` now returns `data.active_package` (`{id, namaPaket}` or `null`), `data.package_balances` (array of `{id, coins_remaining, coins_purchased, purchased_at, package: {namaPaket, jumlahKoin}}`), `data.transactions` (array, newest first, max 10), `data._count` (`{transactions, ai_generations, system_api_logs, feedbacks, package_balances}`).

- [ ] **Step 1: Write the failing test (with full shared fixture)**

Create `be-key-barbershop/src/test/admin.userManagement.test.js`:

```js
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: FAIL — `active_package` is `undefined` (not yet selected by `getUserDetail`).

- [ ] **Step 3: Implement**

In `be-key-barbershop/src/controllers/admin.controller.js`, find the `getUserDetail` function (it currently reads):

```js
const getUserDetail = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        ai_generations: { orderBy: { tgl_generate: "desc" }, take: 10 },
        system_api_logs: { orderBy: { tgl_penggunaan: "desc" }, take: 10 },
      },
    });
```

Replace the `include` block with:

```js
const getUserDetail = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        ai_generations: { orderBy: { tgl_generate: "desc" }, take: 10 },
        system_api_logs: { orderBy: { tgl_penggunaan: "desc" }, take: 10 },
        active_package: { select: { id: true, namaPaket: true } },
        package_balances: {
          include: { package: { select: { namaPaket: true, jumlahKoin: true } } },
          orderBy: { purchased_at: "desc" },
        },
        transactions: { orderBy: { tgl_transaksi: "desc" }, take: 10 },
        _count: {
          select: {
            transactions: true,
            ai_generations: true,
            system_api_logs: true,
            feedbacks: true,
            package_balances: true,
          },
        },
      },
    });
```

The rest of the function (the `if (!user)` check, the `safeUser` destructure, the `catch` block) stays exactly as-is.

- [ ] **Step 4: Run test to verify it passes**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/admin.controller.js src/test/admin.userManagement.test.js
git commit -m "feat: include package balances, transactions, and counts in admin getUserDetail"
```

---

## Task 2: Add `reason` to `adjustCredit` audit log

**Files:**
- Modify: `be-key-barbershop/src/controllers/admin.controller.js` (the `adjustCredit` function)
- Modify: `be-key-barbershop/src/test/admin.userManagement.test.js` (add one `it()` inside the existing `describe` block from Task 1)

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `PATCH /api/v1/admin/users/:id/credit` now accepts an optional `reason` string in the body, persisted into the `AuditLog.details.reason` field.

- [ ] **Step 1: Write the failing test**

Add this `it()` inside the existing `describe("Admin: User & Subscription Management", ...)` block in `admin.userManagement.test.js`, after the Task 1 test:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js -t "menyertakan reason"`
Expected: FAIL — `log.details.reason` is `undefined`.

- [ ] **Step 3: Implement**

In `admin.controller.js`, find this line inside `adjustCredit`:

```js
    await createAuditLog(req.user.id, "ADJUST_CREDIT", user.id, { delta, new_credit: user.sisa_credit }, req);
```

Replace with:

```js
    await createAuditLog(req.user.id, "ADJUST_CREDIT", user.id, { delta, new_credit: user.sisa_credit, reason: req.body.reason }, req);
```

No other change in this function.

- [ ] **Step 4: Run test to verify it passes**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/admin.controller.js src/test/admin.userManagement.test.js
git commit -m "feat: record reason for manual credit adjustments in audit log"
```

---

## Task 3: `POST /admin/users/:id/topup-package`

**Files:**
- Modify: `be-key-barbershop/src/controllers/admin.controller.js` (add import + new function + export)
- Modify: `be-key-barbershop/src/routes/admin.routes.js` (add import + new route)
- Modify: `be-key-barbershop/src/test/admin.userManagement.test.js` (add 3 `it()` blocks)

**Interfaces:**
- Consumes: `creditPackagePurchase(tx, userId, pkg)` from `../services/package.service` — already exists, signature confirmed, do not modify it.
- Produces: `POST /api/v1/admin/users/:id/topup-package` with body `{ packageId: string }`, returns `{ sisa_credit, active_package_id }` on success.

- [ ] **Step 1: Write the failing tests**

Add these 4 `it()` blocks inside the existing `describe` block in `admin.userManagement.test.js`, after Task 2's test:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: FAIL — route doesn't exist yet, so Express falls through to the 404 handler on all 4 new tests (the 403 test will also fail, since a 404 isn't a 403).

- [ ] **Step 3: Implement controller function**

In `admin.controller.js`, add this import at the top, alongside the existing requires:

```js
const { creditPackagePurchase } = require("../services/package.service");
```

Add this new function, right after `deleteUser` (before `requestAdminOTP`):

```js
const topupPackage = async (req, res, next) => {
  try {
    const { packageId } = req.body;
    if (!packageId || typeof packageId !== "string") {
      const error = new Error("packageId wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      include: { llmModel: true, imageModel: true },
    });

    if (!pkg) {
      const error = new Error("Paket tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    if (pkg.status !== "AKTIF") {
      const error = new Error("Paket sedang nonaktif, tidak bisa di-top-up");
      error.statusCode = 400;
      throw error;
    }
    if (!pkg.llmModelId || !pkg.llmModel?.isActive) {
      const error = new Error("Model AI untuk paket ini sedang nonaktif");
      error.statusCode = 400;
      throw error;
    }
    if (pkg.featVirtualTryOn && (!pkg.imageModelId || !pkg.imageModel?.isActive)) {
      const error = new Error("Model Image Gen untuk paket ini sedang nonaktif");
      error.statusCode = 400;
      throw error;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      return creditPackagePurchase(tx, req.params.id, pkg);
    });

    await createAuditLog(req.user.id, "ADMIN_TOPUP_PACKAGE", req.params.id, { packageId, koin: pkg.jumlahKoin }, req);

    return success(res, {
      message: "Top-up paket berhasil",
      data: { sisa_credit: updatedUser.sisa_credit, active_package_id: updatedUser.active_package_id },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { statusCode: error.statusCode || 500, message: error.message });
  }
};
```

Add `topupPackage` to the `module.exports` block at the bottom (next to `deleteUser`).

- [ ] **Step 4: Wire the route**

In `admin.routes.js`, add `topupPackage` to the destructured import at the top:

```js
const {
  getUsers,
  getUserDetail,
  adjustCredit,
  updateUserStatus,
  deleteUser,
  topupPackage,
  updateAdminProfile,
  getAdminProfile,
  getAuditLogs,
  requestAdminOTP,
  getTransactions,
} = require("../controllers/admin.controller");
```

Add the route right after `router.patch("/users/:id/status", updateUserStatus);`:

```js
/**
 * @swagger
 * /v1/admin/users/{id}/topup-package:
 *   post:
 *     summary: Kredit koin paket tertentu ke user (simulasi pembelian manual)
 *     tags: [Admin Management]
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
 *             required: [packageId]
 *             properties:
 *               packageId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Top-up berhasil
 */
router.post("/users/:id/topup-package", topupPackage);
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/controllers/admin.controller.js src/routes/admin.routes.js src/test/admin.userManagement.test.js
git commit -m "feat: add admin endpoint to top-up a user's package balance"
```

---

## Task 4: `PATCH /admin/users/:id/active-package`

**Files:**
- Modify: `be-key-barbershop/src/controllers/admin.controller.js` (add new function + export)
- Modify: `be-key-barbershop/src/routes/admin.routes.js` (add import + new route)
- Modify: `be-key-barbershop/src/test/admin.userManagement.test.js` (add 3 `it()` blocks)

**Interfaces:**
- Produces: `PATCH /api/v1/admin/users/:id/active-package` with body `{ packageId: string | null }`, returns `{ id, active_package_id }`.

- [ ] **Step 1: Write the failing tests**

Add these 4 `it()` blocks at the end of the `describe` block in `admin.userManagement.test.js`:

```js
  it("PATCH /admin/users/:id/active-package mengubah active_package_id kalau user punya balance paket itu", async () => {
    await prisma.user.update({ where: { id: targetUserId }, data: { active_package_id: null } });
    await prisma.userPackageBalance.upsert({
      where: { user_id_package_id: { user_id: targetUserId, package_id: idPaketAum } },
      update: { coins_remaining: 50 },
      create: { user_id: targetUserId, package_id: idPaketAum, coins_purchased: 50, coins_remaining: 50 },
    });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${targetUserId}/active-package`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ packageId: idPaketAum });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.active_package_id).toBe(idPaketAum);
  });

  it("PATCH /admin/users/:id/active-package ditolak 400 kalau user tidak punya balance paket itu", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${targetUserId}/active-package`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ packageId: idPaketAumNonaktif });

    expect(res.statusCode).toBe(400);
  });

  it("PATCH /admin/users/:id/active-package dengan packageId null mencabut paket aktif", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${targetUserId}/active-package`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ packageId: null });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.active_package_id).toBeNull();

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    expect(user.status_langganan).toBe(false);
    expect(user.tipe_akun).toBe("free");
  });

  it("PATCH /admin/users/:id/active-package ditolak 403 untuk non-admin", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${targetUserId}/active-package`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ packageId: idPaketAum });

    expect(res.statusCode).toBe(403);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: FAIL — route doesn't exist (404).

- [ ] **Step 3: Implement controller function**

In `admin.controller.js`, add this function right after `topupPackage`:

```js
const setActivePackage = async (req, res, next) => {
  try {
    const { packageId } = req.body;
    if (packageId !== null && typeof packageId !== "string") {
      const error = new Error("packageId harus berupa string atau null");
      error.statusCode = 400;
      throw error;
    }

    if (packageId === null) {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { active_package_id: null, status_langganan: false, tipe_akun: "free" },
      });
      await createAuditLog(req.user.id, "ADMIN_REVOKE_ACTIVE_PACKAGE", user.id, {}, req);
      return success(res, {
        message: "Paket aktif berhasil dicabut",
        data: { id: user.id, active_package_id: user.active_package_id },
      });
    }

    const balance = await prisma.userPackageBalance.findUnique({
      where: { user_id_package_id: { user_id: req.params.id, package_id: packageId } },
    });

    if (!balance) {
      const error = new Error("User tidak punya saldo untuk paket ini");
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { active_package_id: packageId },
    });

    await createAuditLog(req.user.id, "ADMIN_SET_ACTIVE_PACKAGE", user.id, { packageId }, req);

    return success(res, {
      message: "Paket aktif berhasil diubah",
      data: { id: user.id, active_package_id: user.active_package_id },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return sendError(res, { statusCode: 404, message: "User tidak ditemukan" });
    }
    return sendError(res, { statusCode: error.statusCode || 500, message: error.message });
  }
};
```

Add `setActivePackage` to `module.exports`.

- [ ] **Step 4: Wire the route**

In `admin.routes.js`, add `setActivePackage` to the destructured import (next to `topupPackage`), and add this route right after the `topup-package` route added in Task 3:

```js
/**
 * @swagger
 * /v1/admin/users/{id}/active-package:
 *   patch:
 *     summary: Force-set atau cabut paket aktif user
 *     tags: [Admin Management]
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
 *             required: [packageId]
 *             properties:
 *               packageId:
 *                 type: string
 *                 nullable: true
 *                 description: uuid paket, atau null untuk mencabut paket aktif
 *     responses:
 *       200:
 *         description: Paket aktif berhasil diubah/dicabut
 */
router.patch("/users/:id/active-package", setActivePackage);
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `be-key-barbershop/`): `npx jest src/test/admin.userManagement.test.js`
Expected: PASS (10 tests).

- [ ] **Step 6: Run the full backend test suite for regressions**

Run (from `be-key-barbershop/`): `npm test`
Expected: same pass/fail counts as before this plan started, plus the 8 new passes (no new failures — `anti-boncos.test.js`/`e2e.package-ai.test.js` are pre-existing known failures, see project history).

- [ ] **Step 7: Commit**

```bash
git add src/controllers/admin.controller.js src/routes/admin.routes.js src/test/admin.userManagement.test.js
git commit -m "feat: add admin endpoint to force-set or revoke a user's active package"
```

---

## Task 5: Frontend service + sidebar nav entry

**Files:**
- Create: `fe-key-barbershop/src/services/userManagementService.js`
- Modify: `fe-key-barbershop/src/app/(admin)/layout.jsx`

**Interfaces:**
- Consumes: the 5 admin endpoints from Tasks 1-4 plus the pre-existing `PATCH /admin/users/:id/status` and `DELETE /admin/users/:id`.
- Produces: `userManagementService` object with methods `getUsers`, `getUserDetail`, `topupPackage`, `setActivePackage`, `adjustCredit`, `updateStatus`, `deleteUser` — these exact names are relied on by Tasks 6-9.

- [ ] **Step 1: Create the service file**

Create `fe-key-barbershop/src/services/userManagementService.js`:

```js
import api from "@/utils/request";

export const userManagementService = {
  getUsers: (params) => api.get("/admin/users", params),
  getUserDetail: (id) => api.get(`/admin/users/${id}`),
  topupPackage: (id, packageId) => api.post(`/admin/users/${id}/topup-package`, { packageId }),
  setActivePackage: (id, packageId) => api.patch(`/admin/users/${id}/active-package`, { packageId }),
  adjustCredit: (id, amount, reason) => api.patch(`/admin/users/${id}/credit`, { amount, reason }),
  updateStatus: (id, is_banned) => api.patch(`/admin/users/${id}/status`, { is_banned }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
};
```

- [ ] **Step 2: Add the sidebar nav entry**

In `fe-key-barbershop/src/app/(admin)/layout.jsx`, find this import line (around line 7):

```js
import { Home, Cpu, Tags, Users, ReceiptText, Bell, Share2, LogOut, User, Settings, X, CheckCircle, MessageSquareText } from "lucide-react";
```

Replace it with (adding `UserCog` so the new menu item has its own icon, distinct from the `Users` icon already used by "Barbers"):

```js
import { Home, Cpu, Tags, Users, UserCog, ReceiptText, Bell, Share2, LogOut, User, Settings, X, CheckCircle, MessageSquareText } from "lucide-react";
```

Find the `navigation` array (around line 149):

```js
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "AI Engine Control", href: "/ai-config", icon: Cpu },
    { name: "Harga & Langganan", href: "/langganan", icon: Tags },
    { name: "Transaksi", href: "/transaksi", icon: ReceiptText },
    { name: "Barbers", href: "/barbers", icon: Users },
    { name: "Media Social", href: "/media-social", icon: Share2 },
    { name: "Feedbacks", href: "/feedbacks", icon: MessageSquareText },
  ];
```

Replace with (new entry inserted right after "Harga & Langganan", per the approved design):

```js
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "AI Engine Control", href: "/ai-config", icon: Cpu },
    { name: "Harga & Langganan", href: "/langganan", icon: Tags },
    { name: "User & Subscription", href: "/users", icon: UserCog },
    { name: "Transaksi", href: "/transaksi", icon: ReceiptText },
    { name: "Barbers", href: "/barbers", icon: Users },
    { name: "Media Social", href: "/media-social", icon: Share2 },
    { name: "Feedbacks", href: "/feedbacks", icon: MessageSquareText },
  ];
```

- [ ] **Step 3: Verify it builds**

Run (from `fe-key-barbershop/`): `npm run build`
Expected: build succeeds (the `/users` route will 404 until Task 6 — that's fine, the sidebar link itself is what's being verified here, plus that `userManagementService.js` has no syntax errors since it gets bundled).

- [ ] **Step 4: Commit**

```bash
git add src/services/userManagementService.js "src/app/(admin)/layout.jsx"
git commit -m "feat: add userManagementService and sidebar entry for User & Subscription"
```

---

## Task 6: `/users` list page

**Files:**
- Create: `fe-key-barbershop/src/app/(admin)/users/page.jsx`

**Interfaces:**
- Consumes: `userManagementService.getUsers(params)` from Task 5 — `params` is `{ page, limit, search }`, response shape `res.data.data` (array of `{id, nama, email, tipe_akun, status_langganan, sisa_credit, is_banned}`), `res.data.meta.totalPages`.
- Produces: navigates to `/users/[id]` on row click — relied on by Task 7.

- [ ] **Step 1: Create the page**

Create `fe-key-barbershop/src/app/(admin)/users/page.jsx`:

```jsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { userManagementService } from "@/services/userManagementService";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers(page, search);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [page, search]);

  const fetchUsers = async (pageToFetch, querySearch) => {
    setLoading(true);
    setError(null);
    try {
      const res = await userManagementService.getUsers({ page: pageToFetch, limit: 10, search: querySearch });
      if (res.data.success) {
        setUsers(res.data.data || []);
        setTotalPages(res.data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error("Gagal memuat user:", err);
      setError(err?.response?.data?.message || "Gagal memuat daftar user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
      <div>
        <h1 className="text-2xl font-bold text-[#2b1d19]" style={{ fontFamily: "var(--font-noto-serif)" }}>
          User & Subscription
        </h1>
        <p className="text-sm text-[#8b6f66] mt-1">Kelola data user, paket aktif, dan saldo koin</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b6f66]" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari nama atau email..."
          className="w-full pl-10 pr-4 py-2.5 border border-[#e6d1c7] rounded-lg text-sm text-[#2b1d19] focus:outline-none focus:ring-2 focus:ring-[#4a1a1a]/20"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white border border-[#e6d1c7] rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#4a1a1a] border-b border-[#e6d1c7]">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold text-left">Nama</th>
                <th scope="col" className="px-6 py-4 font-bold text-left">Email</th>
                <th scope="col" className="px-6 py-4 font-bold text-center">Tipe Akun</th>
                <th scope="col" className="px-6 py-4 font-bold text-center">Status Langganan</th>
                <th scope="col" className="px-6 py-4 font-bold text-center">Sisa Credit</th>
                <th scope="col" className="px-6 py-4 font-bold text-center">Status</th>
                <th scope="col" className="px-6 py-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Memuat...</td>
                </tr>
              ) : users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id} className="bg-white border-b border-[#e6d1c7] hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-4 text-[#2b1d19] font-medium">{u.nama}</td>
                    <td className="px-6 py-4 text-[#8b6f66]">{u.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">{u.tipe_akun}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-[#8b6f66]">
                      {u.status_langganan ? "Aktif" : "Tidak aktif"}
                    </td>
                    <td className="px-6 py-4 text-center text-[#8b6f66]">{u.sisa_credit}</td>
                    <td className="px-6 py-4 text-center">
                      {u.is_banned ? (
                        <span className="bg-[#fecaca] text-[#991b1b] text-[10px] font-bold px-2 py-1 rounded-md">BANNED</span>
                      ) : (
                        <span className="bg-[#bbf7d0] text-[#166534] text-[10px] font-bold px-2 py-1 rounded-md">AKTIF</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => router.push(`/users/${u.id}`)}
                        className="text-[#4a1a1a] hover:text-[#8b6f66] font-semibold text-xs transition-colors"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Belum ada user</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[#8b6f66]">Halaman {page} dari {totalPages}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 border border-[#e6d1c7] rounded-lg disabled:opacity-40 hover:bg-[#fafafa]"
          >
            <ChevronLeft className="w-4 h-4 text-[#4a1a1a]" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 border border-[#e6d1c7] rounded-lg disabled:opacity-40 hover:bg-[#fafafa]"
          >
            <ChevronRight className="w-4 h-4 text-[#4a1a1a]" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run (from `fe-key-barbershop/`): `npm run build`
Expected: build succeeds, `/users` listed in the route output.

- [ ] **Step 3: Manual verification**

Run (from `fe-key-barbershop/`): `npm run dev`, then in a browser log in as admin and open `/users`.
Checklist:
- Table loads with real users from the DB.
- Typing in the search box filters after ~500ms.
- Pagination buttons disable correctly at first/last page.
- Clicking "Detail" navigates to `/users/<id>` (will 404 until Task 7 — expected at this point).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/users/page.jsx"
git commit -m "feat: add admin user list page with search and pagination"
```

---

## Task 7: `/users/[id]` detail page — skeleton, Info User, Ban/Unban, read-only Paket Aktif & Saldo per Paket

**Files:**
- Create: `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx`

**Interfaces:**
- Consumes: `userManagementService.getUserDetail(id)` (Task 5, backed by Task 1's extended response) and `userManagementService.updateStatus(id, is_banned)` (Task 5, pre-existing backend endpoint, unchanged).
- Produces: a `fetchDetail()` function and `user` state object that Tasks 8-9 will extend with more sections/handlers in the SAME file. The full file is rewritten at the end of each of Tasks 7, 8, and 9 — there is no separate "Task 8 patches Task 7's file via diff" step, each task shows the complete file as it should exist after that task, to avoid an implementer guessing at insertion points in a file they didn't write.

- [ ] **Step 1: Create the page**

Create `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx`:

```jsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { userManagementService } from "@/services/userManagementService";
import { useToast } from "@/contexts/ToastContext";

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast, showConfirm } = useToast();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userManagementService.getUserDetail(id);
      if (res.data.success) {
        setUser(res.data.data);
      }
    } catch (err) {
      console.error("Gagal memuat detail user:", err);
      setError(err?.response?.data?.message || "Gagal memuat detail user");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = () => {
    const nextBanned = !user.is_banned;
    const verb = nextBanned ? "mem-banned" : "meng-unban";
    showConfirm(
      nextBanned ? "Ban User" : "Unban User",
      `Apakah Anda yakin ingin ${verb} user "${user.nama}"?`,
      async () => {
        try {
          const res = await userManagementService.updateStatus(id, nextBanned);
          if (res.data.success) {
            showToast(`User berhasil di${nextBanned ? "banned" : "unban"}!`, "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || `Gagal ${verb} user`, "error");
        }
      }
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-[#8b6f66]">Memuat...</div>;
  }

  if (error || !user) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || "User tidak ditemukan"}
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
      <button
        onClick={() => router.push("/users")}
        className="flex items-center gap-2 text-sm text-[#8b6f66] hover:text-[#4a1a1a] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar user
      </button>

      <div className="bg-white border border-[#e6d1c7] rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#2b1d19]" style={{ fontFamily: "var(--font-noto-serif)" }}>
              {user.nama}
            </h1>
            <p className="text-sm text-[#8b6f66] mt-1">{user.email}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-[#8b6f66]">
              <span className="bg-gray-100 px-2 py-1 rounded">{user.tipe_akun}</span>
              <span>Daftar: {new Date(user.createdAt).toLocaleDateString("id-ID")}</span>
              {user.is_banned ? (
                <span className="bg-[#fecaca] text-[#991b1b] font-bold px-2 py-1 rounded-md">BANNED</span>
              ) : (
                <span className="bg-[#bbf7d0] text-[#166534] font-bold px-2 py-1 rounded-md">AKTIF</span>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleBan}
            className={
              user.is_banned
                ? "flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#0f3d22] text-white text-xs font-semibold transition-colors"
                : "flex items-center gap-2 px-4 py-2 rounded-lg bg-[#991b1b] hover:bg-[#7a1616] text-white text-xs font-semibold transition-colors"
            }
          >
            {user.is_banned ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {user.is_banned ? "Unban User" : "Ban User"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg p-6 shadow-sm">
        <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide mb-3">Paket Aktif</h2>
        <p className="text-[#2b1d19]">
          {user.active_package ? user.active_package.namaPaket : "Tidak ada paket aktif"}
        </p>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 pb-0">
          <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide">Saldo per Paket</h2>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#4a1a1a] border-b border-[#e6d1c7]">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold text-left">Nama Paket</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Sisa Koin</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Total Dibeli</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Tanggal Beli</th>
              </tr>
            </thead>
            <tbody>
              {user.package_balances.length > 0 ? (
                user.package_balances.map((b) => (
                  <tr key={b.id} className="border-b border-[#e6d1c7] hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-3 text-[#2b1d19] font-medium">{b.package.namaPaket}</td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">{b.coins_remaining}</td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">{b.coins_purchased}</td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">
                      {new Date(b.purchased_at).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-6 text-center text-gray-500">Belum ada saldo paket</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run (from `fe-key-barbershop/`): `npm run build`
Expected: build succeeds, `/users/[id]` listed as a dynamic route.

- [ ] **Step 3: Manual verification**

Run (from `fe-key-barbershop/`): `npm run dev`, navigate to `/users/<a real user id>`.
Checklist:
- Nama, email, tipe_akun, tanggal daftar, badge AKTIF/BANNED render correctly.
- "Ban User" / "Unban User" button toggles correctly with confirm dialog, page refreshes with updated badge after confirming.
- "Paket Aktif" shows the correct package name or "Tidak ada paket aktif".
- "Saldo per Paket" table lists all packages the user has balance for.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/users/[id]/page.jsx"
git commit -m "feat: add admin user detail page with ban/unban and read-only package info"
```

---

## Task 8: Add Top-up Paket, Set sebagai Aktif, and Cabut Paket Aktif

**Files:**
- Modify: `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx` (full rewrite, builds on Task 7's file)

**Interfaces:**
- Consumes: `userManagementService.topupPackage(id, packageId)` and `userManagementService.setActivePackage(id, packageId)` (both from Task 5, backed by Tasks 3 and 4). Also consumes `packageService.getPackages(1, 100)` (pre-existing, from `@/services/packageService`) to populate the top-up dropdown — same call already used by `langganan/page.jsx`, response shape `res.data.data.topup_koin` + `res.data.data.langganan_premium`, each package object has `status` (computed `"AKTIF"`/`"NONAKTIF"`).
- Produces: nothing new consumed by later tasks — Task 9 only adds more independent sections to the same file.

This task replaces the ENTIRE content of `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx` written in Task 7. Below is the complete file as it should exist after this task.

- [ ] **Step 1: Rewrite the page with the new actions**

Replace the full content of `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx` with:

```jsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck, Coins, X, Loader2, CircleSlash } from "lucide-react";
import { userManagementService } from "@/services/userManagementService";
import { packageService } from "@/services/packageService";
import { useToast } from "@/contexts/ToastContext";

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast, showConfirm } = useToast();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [isTopupSubmitting, setIsTopupSubmitting] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userManagementService.getUserDetail(id);
      if (res.data.success) {
        setUser(res.data.data);
      }
    } catch (err) {
      console.error("Gagal memuat detail user:", err);
      setError(err?.response?.data?.message || "Gagal memuat detail user");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = () => {
    const nextBanned = !user.is_banned;
    const verb = nextBanned ? "mem-banned" : "meng-unban";
    showConfirm(
      nextBanned ? "Ban User" : "Unban User",
      `Apakah Anda yakin ingin ${verb} user "${user.nama}"?`,
      async () => {
        try {
          const res = await userManagementService.updateStatus(id, nextBanned);
          if (res.data.success) {
            showToast(`User berhasil di${nextBanned ? "banned" : "unban"}!`, "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || `Gagal ${verb} user`, "error");
        }
      }
    );
  };

  const handleOpenTopupModal = async () => {
    setSelectedPackageId("");
    setIsTopupModalOpen(true);
    try {
      const res = await packageService.getPackages(1, 100);
      if (res.data.success) {
        const combined = [
          ...(res.data.data.topup_koin || []),
          ...(res.data.data.langganan_premium || []),
        ];
        setAvailablePackages(combined.filter((p) => p.status === "AKTIF"));
      }
    } catch (err) {
      console.error("Gagal memuat daftar paket:", err);
      showToast("Gagal memuat daftar paket aktif", "error");
    }
  };

  const handleTopup = async () => {
    if (!selectedPackageId) {
      showToast("Pilih paket terlebih dahulu", "error");
      return;
    }
    setIsTopupSubmitting(true);
    try {
      const res = await userManagementService.topupPackage(id, selectedPackageId);
      if (res.data.success) {
        showToast("Top-up paket berhasil!", "success");
        setIsTopupModalOpen(false);
        fetchDetail();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Gagal top-up paket", "error");
    } finally {
      setIsTopupSubmitting(false);
    }
  };

  const handleSetActive = (packageId, namaPaket) => {
    showConfirm(
      "Set Paket Aktif",
      `Jadikan "${namaPaket}" sebagai paket aktif user ini?`,
      async () => {
        try {
          const res = await userManagementService.setActivePackage(id, packageId);
          if (res.data.success) {
            showToast("Paket aktif berhasil diubah!", "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || "Gagal mengubah paket aktif", "error");
        }
      }
    );
  };

  const handleCabutAktif = () => {
    showConfirm(
      "Cabut Paket Aktif",
      `Cabut paket aktif dari user "${user.nama}"? User tidak akan punya paket aktif setelah ini.`,
      async () => {
        try {
          const res = await userManagementService.setActivePackage(id, null);
          if (res.data.success) {
            showToast("Paket aktif berhasil dicabut!", "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || "Gagal mencabut paket aktif", "error");
        }
      }
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-[#8b6f66]">Memuat...</div>;
  }

  if (error || !user) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || "User tidak ditemukan"}
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
      <button
        onClick={() => router.push("/users")}
        className="flex items-center gap-2 text-sm text-[#8b6f66] hover:text-[#4a1a1a] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar user
      </button>

      <div className="bg-white border border-[#e6d1c7] rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#2b1d19]" style={{ fontFamily: "var(--font-noto-serif)" }}>
              {user.nama}
            </h1>
            <p className="text-sm text-[#8b6f66] mt-1">{user.email}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-[#8b6f66]">
              <span className="bg-gray-100 px-2 py-1 rounded">{user.tipe_akun}</span>
              <span>Daftar: {new Date(user.createdAt).toLocaleDateString("id-ID")}</span>
              {user.is_banned ? (
                <span className="bg-[#fecaca] text-[#991b1b] font-bold px-2 py-1 rounded-md">BANNED</span>
              ) : (
                <span className="bg-[#bbf7d0] text-[#166534] font-bold px-2 py-1 rounded-md">AKTIF</span>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleBan}
            className={
              user.is_banned
                ? "flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#0f3d22] text-white text-xs font-semibold transition-colors"
                : "flex items-center gap-2 px-4 py-2 rounded-lg bg-[#991b1b] hover:bg-[#7a1616] text-white text-xs font-semibold transition-colors"
            }
          >
            {user.is_banned ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {user.is_banned ? "Unban User" : "Ban User"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide mb-3">Paket Aktif</h2>
            <p className="text-[#2b1d19]">
              {user.active_package ? user.active_package.namaPaket : "Tidak ada paket aktif"}
            </p>
          </div>
          <button
            onClick={handleCabutAktif}
            disabled={!user.active_package}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e6d1c7] text-xs font-semibold text-[#991b1b] hover:bg-[#fecaca]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CircleSlash className="w-4 h-4" />
            Cabut Paket Aktif
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 pb-0 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide">Saldo per Paket</h2>
          <button
            onClick={handleOpenTopupModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4a1a1a] hover:bg-[#2b1d19] text-white text-xs font-semibold transition-colors"
          >
            <Coins className="w-4 h-4" />
            Top-up Paket
          </button>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#4a1a1a] border-b border-[#e6d1c7]">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold text-left">Nama Paket</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Sisa Koin</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Total Dibeli</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Tanggal Beli</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {user.package_balances.length > 0 ? (
                user.package_balances.map((b) => {
                  const isCurrentActive = user.active_package?.id === b.package_id;
                  return (
                    <tr key={b.id} className="border-b border-[#e6d1c7] hover:bg-[#fafafa] transition-colors">
                      <td className="px-6 py-3 text-[#2b1d19] font-medium">{b.package.namaPaket}</td>
                      <td className="px-6 py-3 text-center text-[#8b6f66]">{b.coins_remaining}</td>
                      <td className="px-6 py-3 text-center text-[#8b6f66]">{b.coins_purchased}</td>
                      <td className="px-6 py-3 text-center text-[#8b6f66]">
                        {new Date(b.purchased_at).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleSetActive(b.package_id, b.package.namaPaket)}
                          disabled={isCurrentActive}
                          className="text-[#4a1a1a] hover:text-[#8b6f66] font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCurrentActive ? "Sedang Aktif" : "Set sebagai Aktif"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-6 text-center text-gray-500">Belum ada saldo paket</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isTopupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#2b1d19]">Top-up Paket</h2>
                <button
                  onClick={() => setIsTopupModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block text-xs font-semibold text-[#4a1a1a] mb-2">Pilih Paket</label>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e6d1c7] rounded-lg text-sm text-[#2b1d19] focus:outline-none focus:ring-2 focus:ring-[#4a1a1a]/20"
              >
                <option value="">-- Pilih paket --</option>
                {availablePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.koin} koin)
                  </option>
                ))}
              </select>

              <button
                onClick={handleTopup}
                disabled={isTopupSubmitting}
                className="flex items-center justify-center gap-2 mt-6 px-8 py-3 rounded-lg bg-[#4a1a1a] hover:bg-[#2b1d19] text-white text-sm font-semibold transition-colors disabled:opacity-70 w-full"
              >
                {isTopupSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                <span>Top-up Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run (from `fe-key-barbershop/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification**

Run (from `fe-key-barbershop/`): `npm run dev`, navigate to `/users/<id>` for a user with at least one package balance.
Checklist:
- "Top-up Paket" opens the modal with a dropdown of only `AKTIF` packages.
- Submitting top-up shows a success toast, modal closes, "Saldo per Paket" table updates with the new/increased balance.
- "Set sebagai Aktif" on a non-active balance row switches the active package after confirming (verify "Paket Aktif" section updates).
- The currently active package's row shows "Sedang Aktif" and its button is disabled.
- "Cabut Paket Aktif" is disabled when there's no active package, and clears "Paket Aktif" to "Tidak ada paket aktif" after confirming when there is one.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/users/[id]/page.jsx"
git commit -m "feat: add top-up package, set active, and revoke active actions to user detail"
```

---

## Task 9: Add Koreksi Saldo Utama, Riwayat Transaksi/AI Generation, and Zona Bahaya (Hapus User)

**Files:**
- Modify: `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx` (full rewrite, builds on Task 8's file — this is the final state of the file)

**Interfaces:**
- Consumes: `userManagementService.adjustCredit(id, amount, reason)` and `userManagementService.deleteUser(id)` (both from Task 5, the first backed by Task 2, the second pre-existing/unchanged). Also reads `user.transactions`, `user.ai_generations`, and `user._count` already present in the response since Task 1.
- Produces: nothing further — this is the last task in the plan.

This task replaces the ENTIRE content of `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx` written in Task 8. Below is the complete, final file.

- [ ] **Step 1: Rewrite the page with the remaining sections**

Replace the full content of `fe-key-barbershop/src/app/(admin)/users/[id]/page.jsx` with:

```jsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Coins,
  X,
  Loader2,
  CircleSlash,
  Wallet,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { userManagementService } from "@/services/userManagementService";
import { packageService } from "@/services/packageService";
import { useToast } from "@/contexts/ToastContext";

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast, showConfirm } = useToast();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [isTopupSubmitting, setIsTopupSubmitting] = useState(false);

  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [isCreditSubmitting, setIsCreditSubmitting] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userManagementService.getUserDetail(id);
      if (res.data.success) {
        setUser(res.data.data);
      }
    } catch (err) {
      console.error("Gagal memuat detail user:", err);
      setError(err?.response?.data?.message || "Gagal memuat detail user");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = () => {
    const nextBanned = !user.is_banned;
    const verb = nextBanned ? "mem-banned" : "meng-unban";
    showConfirm(
      nextBanned ? "Ban User" : "Unban User",
      `Apakah Anda yakin ingin ${verb} user "${user.nama}"?`,
      async () => {
        try {
          const res = await userManagementService.updateStatus(id, nextBanned);
          if (res.data.success) {
            showToast(`User berhasil di${nextBanned ? "banned" : "unban"}!`, "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || `Gagal ${verb} user`, "error");
        }
      }
    );
  };

  const handleOpenTopupModal = async () => {
    setSelectedPackageId("");
    setIsTopupModalOpen(true);
    try {
      const res = await packageService.getPackages(1, 100);
      if (res.data.success) {
        const combined = [
          ...(res.data.data.topup_koin || []),
          ...(res.data.data.langganan_premium || []),
        ];
        setAvailablePackages(combined.filter((p) => p.status === "AKTIF"));
      }
    } catch (err) {
      console.error("Gagal memuat daftar paket:", err);
      showToast("Gagal memuat daftar paket aktif", "error");
    }
  };

  const handleTopup = async () => {
    if (!selectedPackageId) {
      showToast("Pilih paket terlebih dahulu", "error");
      return;
    }
    setIsTopupSubmitting(true);
    try {
      const res = await userManagementService.topupPackage(id, selectedPackageId);
      if (res.data.success) {
        showToast("Top-up paket berhasil!", "success");
        setIsTopupModalOpen(false);
        fetchDetail();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Gagal top-up paket", "error");
    } finally {
      setIsTopupSubmitting(false);
    }
  };

  const handleSetActive = (packageId, namaPaket) => {
    showConfirm(
      "Set Paket Aktif",
      `Jadikan "${namaPaket}" sebagai paket aktif user ini?`,
      async () => {
        try {
          const res = await userManagementService.setActivePackage(id, packageId);
          if (res.data.success) {
            showToast("Paket aktif berhasil diubah!", "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || "Gagal mengubah paket aktif", "error");
        }
      }
    );
  };

  const handleCabutAktif = () => {
    showConfirm(
      "Cabut Paket Aktif",
      `Cabut paket aktif dari user "${user.nama}"? User tidak akan punya paket aktif setelah ini.`,
      async () => {
        try {
          const res = await userManagementService.setActivePackage(id, null);
          if (res.data.success) {
            showToast("Paket aktif berhasil dicabut!", "success");
            fetchDetail();
          }
        } catch (err) {
          showToast(err?.response?.data?.message || "Gagal mencabut paket aktif", "error");
        }
      }
    );
  };

  const handleOpenCreditModal = () => {
    setCreditAmount("");
    setCreditReason("");
    setIsCreditModalOpen(true);
  };

  const handleAdjustCredit = async () => {
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      showToast("Masukkan angka delta yang valid (boleh negatif)", "error");
      return;
    }
    if (!creditReason.trim()) {
      showToast("Alasan koreksi saldo wajib diisi", "error");
      return;
    }
    setIsCreditSubmitting(true);
    try {
      const res = await userManagementService.adjustCredit(id, amount, creditReason.trim());
      if (res.data.success) {
        showToast("Saldo utama berhasil dikoreksi!", "success");
        setIsCreditModalOpen(false);
        fetchDetail();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Gagal mengoreksi saldo", "error");
    } finally {
      setIsCreditSubmitting(false);
    }
  };

  const handleDeleteUser = () => {
    showConfirm(
      "Hapus User",
      `Aksi ini tidak bisa dibatalkan. Hapus permanen user "${user.nama}"?`,
      async () => {
        try {
          const res = await userManagementService.deleteUser(id);
          if (res.data.success) {
            showToast("User berhasil dihapus!", "success");
            router.push("/users");
          }
        } catch (err) {
          showToast(err?.response?.data?.message || "Gagal menghapus user", "error");
        }
      }
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-[#8b6f66]">Memuat...</div>;
  }

  if (error || !user) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || "User tidak ditemukan"}
      </div>
    );
  }

  const hasHistory =
    user._count.transactions > 0 ||
    user._count.ai_generations > 0 ||
    user._count.system_api_logs > 0 ||
    user._count.feedbacks > 0 ||
    user._count.package_balances > 0;

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
      <button
        onClick={() => router.push("/users")}
        className="flex items-center gap-2 text-sm text-[#8b6f66] hover:text-[#4a1a1a] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar user
      </button>

      <div className="bg-white border border-[#e6d1c7] rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#2b1d19]" style={{ fontFamily: "var(--font-noto-serif)" }}>
              {user.nama}
            </h1>
            <p className="text-sm text-[#8b6f66] mt-1">{user.email}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-[#8b6f66]">
              <span className="bg-gray-100 px-2 py-1 rounded">{user.tipe_akun}</span>
              <span>Daftar: {new Date(user.createdAt).toLocaleDateString("id-ID")}</span>
              <span>Sisa Credit: {user.sisa_credit}</span>
              {user.is_banned ? (
                <span className="bg-[#fecaca] text-[#991b1b] font-bold px-2 py-1 rounded-md">BANNED</span>
              ) : (
                <span className="bg-[#bbf7d0] text-[#166534] font-bold px-2 py-1 rounded-md">AKTIF</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleToggleBan}
              className={
                user.is_banned
                  ? "flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#0f3d22] text-white text-xs font-semibold transition-colors"
                  : "flex items-center gap-2 px-4 py-2 rounded-lg bg-[#991b1b] hover:bg-[#7a1616] text-white text-xs font-semibold transition-colors"
              }
            >
              {user.is_banned ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              {user.is_banned ? "Unban User" : "Ban User"}
            </button>
            <button
              onClick={handleOpenCreditModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e6d1c7] text-xs font-semibold text-[#4a1a1a] hover:bg-[#fafafa] transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Koreksi Saldo Utama
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide mb-3">Paket Aktif</h2>
            <p className="text-[#2b1d19]">
              {user.active_package ? user.active_package.namaPaket : "Tidak ada paket aktif"}
            </p>
          </div>
          <button
            onClick={handleCabutAktif}
            disabled={!user.active_package}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e6d1c7] text-xs font-semibold text-[#991b1b] hover:bg-[#fecaca]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CircleSlash className="w-4 h-4" />
            Cabut Paket Aktif
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 pb-0 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide">Saldo per Paket</h2>
          <button
            onClick={handleOpenTopupModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4a1a1a] hover:bg-[#2b1d19] text-white text-xs font-semibold transition-colors"
          >
            <Coins className="w-4 h-4" />
            Top-up Paket
          </button>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#4a1a1a] border-b border-[#e6d1c7]">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold text-left">Nama Paket</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Sisa Koin</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Total Dibeli</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Tanggal Beli</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {user.package_balances.length > 0 ? (
                user.package_balances.map((b) => {
                  const isCurrentActive = user.active_package?.id === b.package_id;
                  return (
                    <tr key={b.id} className="border-b border-[#e6d1c7] hover:bg-[#fafafa] transition-colors">
                      <td className="px-6 py-3 text-[#2b1d19] font-medium">{b.package.namaPaket}</td>
                      <td className="px-6 py-3 text-center text-[#8b6f66]">{b.coins_remaining}</td>
                      <td className="px-6 py-3 text-center text-[#8b6f66]">{b.coins_purchased}</td>
                      <td className="px-6 py-3 text-center text-[#8b6f66]">
                        {new Date(b.purchased_at).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleSetActive(b.package_id, b.package.namaPaket)}
                          disabled={isCurrentActive}
                          className="text-[#4a1a1a] hover:text-[#8b6f66] font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCurrentActive ? "Sedang Aktif" : "Set sebagai Aktif"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-6 text-center text-gray-500">Belum ada saldo paket</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 pb-0">
          <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide">Riwayat Transaksi</h2>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#4a1a1a] border-b border-[#e6d1c7]">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold text-left">Jenis</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Nominal</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Status</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {user.transactions.length > 0 ? (
                user.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-[#e6d1c7] hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-3 text-[#2b1d19] font-medium">{t.jenis_transaksi}</td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">
                      Rp{t.nominal.toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">{t.status}</td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">
                      {new Date(t.tgl_transaksi).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-6 text-center text-gray-500">Belum ada transaksi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#e6d1c7] rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 pb-0">
          <h2 className="text-sm font-bold text-[#4a1a1a] uppercase tracking-wide">Riwayat AI Generation</h2>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#4a1a1a] border-b border-[#e6d1c7]">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold text-center">Koin Terpakai</th>
                <th scope="col" className="px-6 py-3 font-bold text-center">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {user.ai_generations.length > 0 ? (
                user.ai_generations.map((g) => (
                  <tr key={g.id} className="border-b border-[#e6d1c7] hover:bg-[#fafafa] transition-colors">
                    <td className="px-6 py-3 text-center text-[#8b6f66]">{g.harga_credit_terpakai}</td>
                    <td className="px-6 py-3 text-center text-[#8b6f66]">
                      {new Date(g.tgl_generate).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="px-6 py-6 text-center text-gray-500">Belum ada riwayat AI generation</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#fecaca] rounded-lg p-6 shadow-sm">
        <h2 className="text-sm font-bold text-[#991b1b] uppercase tracking-wide mb-3">Zona Bahaya</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8b6f66] max-w-md">
            {hasHistory
              ? "User ini punya riwayat transaksi/AI generation/saldo paket, sehingga tidak bisa dihapus permanen. Gunakan Ban User di atas sebagai gantinya."
              : "User ini belum punya riwayat apapun dan aman untuk dihapus permanen."}
          </p>
          <button
            onClick={handleDeleteUser}
            disabled={hasHistory}
            title={hasHistory ? "Tidak bisa hapus user yang punya riwayat data" : "Hapus user permanen"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#991b1b] hover:bg-[#7a1616] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Hapus User
          </button>
        </div>
      </div>

      {isTopupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#2b1d19]">Top-up Paket</h2>
                <button
                  onClick={() => setIsTopupModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block text-xs font-semibold text-[#4a1a1a] mb-2">Pilih Paket</label>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#e6d1c7] rounded-lg text-sm text-[#2b1d19] focus:outline-none focus:ring-2 focus:ring-[#4a1a1a]/20"
              >
                <option value="">-- Pilih paket --</option>
                {availablePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.koin} koin)
                  </option>
                ))}
              </select>

              <button
                onClick={handleTopup}
                disabled={isTopupSubmitting}
                className="flex items-center justify-center gap-2 mt-6 px-8 py-3 rounded-lg bg-[#4a1a1a] hover:bg-[#2b1d19] text-white text-sm font-semibold transition-colors disabled:opacity-70 w-full"
              >
                {isTopupSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                <span>Top-up Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#2b1d19]">Koreksi Saldo Utama</h2>
                <button
                  onClick={() => setIsCreditModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Sisa credit saat ini: <strong>{user.sisa_credit}</strong>. Gunakan angka negatif untuk mengurangi.
                </p>
              </div>

              <label className="block text-xs font-semibold text-[#4a1a1a] mb-2">Delta Koin (boleh negatif)</label>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="contoh: 10 atau -5"
                className="w-full px-4 py-2.5 border border-[#e6d1c7] rounded-lg text-sm text-[#2b1d19] focus:outline-none focus:ring-2 focus:ring-[#4a1a1a]/20"
              />

              <label className="block text-xs font-semibold text-[#4a1a1a] mt-4 mb-2">Alasan</label>
              <textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                rows={3}
                placeholder="contoh: Kompensasi error sistem tanggal 24 Juni"
                className="w-full px-4 py-2.5 border border-[#e6d1c7] rounded-lg text-sm text-[#2b1d19] focus:outline-none focus:ring-2 focus:ring-[#4a1a1a]/20"
              />

              <button
                onClick={handleAdjustCredit}
                disabled={isCreditSubmitting}
                className="flex items-center justify-center gap-2 mt-6 px-8 py-3 rounded-lg bg-[#4a1a1a] hover:bg-[#2b1d19] text-white text-sm font-semibold transition-colors disabled:opacity-70 w-full"
              >
                {isCreditSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                <span>Simpan Koreksi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run (from `fe-key-barbershop/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification**

Run (from `fe-key-barbershop/`): `npm run dev`, navigate to `/users/<id>`.
Checklist:
- "Koreksi Saldo Utama" modal rejects empty/zero amount and empty reason with a toast, accepts a valid delta + reason, updates "Sisa Credit" in the header after success.
- "Riwayat Transaksi" and "Riwayat AI Generation" tables render existing rows or the empty-state message.
- For a user WITH any transaction/AI generation/package balance: "Hapus User" button is disabled with an explanatory message, tooltip shows on hover.
- For a freshly-registered user with zero activity: "Hapus User" is enabled, clicking it shows a confirm dialog, confirming deletes the user and redirects to `/users`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/users/[id]/page.jsx"
git commit -m "feat: add credit correction, transaction/AI history, and guarded user deletion"
```

---

## Final verification (after all 9 tasks)

- [ ] Run (from `be-key-barbershop/`): `npm test` — confirm no new failures beyond the pre-existing `anti-boncos.test.js`/`e2e.package-ai.test.js`.
- [ ] Run (from `fe-key-barbershop/`): `npm run build` — confirm clean build with both `/users` and `/users/[id]` routes listed.
- [ ] Manual smoke test end-to-end: as admin, search for a real user, open detail, top-up a package, set it active, adjust credit with a reason, ban then unban, confirm delete is correctly disabled.
- [ ] Confirm every mutating action created a row in `audit_logs` with the expected `action` value (`ADMIN_TOPUP_PACKAGE`, `ADMIN_SET_ACTIVE_PACKAGE`, `ADMIN_REVOKE_ACTIVE_PACKAGE`, `ADJUST_CREDIT`, `UPDATE_USER_STATUS`, `DELETE_USER`).
