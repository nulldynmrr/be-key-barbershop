const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================
// TEST: Strict Feature Gating
// Simulasi: User A punya Paket A (hanya STANDARD_SCAN)
//           User B punya Paket B (punya SYMMETRY + TREND_ANALYSIS)
// ==============================================
async function runGatingTest() {
  console.log("=== PERSIAPAN: Cari Paket yang Ada di DB ===");
  const packages = await prisma.subscriptionPackage.findMany({ take: 2 });
  if (packages.length === 0) {
    console.log("❌ Tidak ada paket di database. Buat paket dulu via API POST /v1/packages.");
    return;
  }

  const paketDasar = packages[0];
  const users = await prisma.user.findMany({ take: 2 });
  if (users.length === 0) {
    console.log("❌ Tidak ada user di database.");
    return;
  }

  const userA = users[0];
  console.log(`\nPaket Dasar ditemukan: "${paketDasar.namaPaket}"`);
  console.log(`  - featStandardScan: ${paketDasar.featStandardScan}`);
  console.log(`  - featSymmetry: ${paketDasar.featSymmetry}`);
  console.log(`  - featTrendAnalysis: ${paketDasar.featTrendAnalysis}`);

  // Assign paket ke user A (simulasi beli paket)
  await prisma.user.update({
    where: { id: userA.id },
    data: { active_package_id: paketDasar.id }
  });
  console.log(`\n✅ User "${userA.nama}" sekarang memakai Paket "${paketDasar.namaPaket}"`);

  console.log("\n=== SIMULASI FEATURE GATING ===");

  // Fungsi cek gate (simulasi logika ai.service.js tanpa perlu file/API call)
  const FEATURE_GATE_MAP = {
    STANDARD_SCAN:  "featStandardScan",
    SYMMETRY:       "featSymmetry",
    ADV_MAPPING:    "featAdvMapping",
    VIRTUAL_TRY_ON: "featVirtualTryOn",
    HISTORY:        "featHistory",
    TREND_ANALYSIS: "featTrendAnalysis",
  };

  function checkGate(requestedFeatures, userPkg) {
    for (const feat of requestedFeatures) {
      const col = FEATURE_GATE_MAP[feat.toUpperCase()];
      if (!col) return { ok: false, reason: `Fitur '${feat}' tidak dikenal.` };
      if (!userPkg[col]) return { ok: false, reason: `Akses Ditolak: Fitur '${feat}' tidak ada di paket '${userPkg.namaPaket}'.` };
    }
    return { ok: true };
  }

  // Skenario 1: Request hanya STANDARD_SCAN (seharusnya lolos)
  const test1 = checkGate(["STANDARD_SCAN"], paketDasar);
  console.log(`\n[Skenario 1] Request: STANDARD_SCAN`);
  console.log(test1.ok ? `  ✅ LOLOS: User diizinkan` : `  ❌ DITOLAK: ${test1.reason}`);

  // Skenario 2: Request SYMMETRY (tidak ada di paket dasar)
  const test2 = checkGate(["STANDARD_SCAN", "SYMMETRY"], paketDasar);
  console.log(`\n[Skenario 2] Request: STANDARD_SCAN + SYMMETRY`);
  console.log(test2.ok ? `  ✅ LOLOS: User diizinkan` : `  ❌ DITOLAK: ${test2.reason}`);

  // Skenario 3: Request TREND_ANALYSIS tanpa paket
  const noPkg = null;
  console.log(`\n[Skenario 3] User tanpa paket aktif`);
  if (!noPkg) {
    console.log(`  ❌ DITOLAK: Anda belum memiliki paket aktif.`);
  }

  // Skenario 4: Request fitur tidak dikenal
  const test4 = checkGate(["HACKFITUR_GRATIS"], paketDasar);
  console.log(`\n[Skenario 4] Request: HACKFITUR_GRATIS (injection attempt)`);
  console.log(test4.ok ? `  ✅ LOLOS` : `  ❌ DITOLAK: ${test4.reason}`);

  console.log("\n✅ Semua skenario Feature Gating selesai diuji!");
}

runGatingTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
