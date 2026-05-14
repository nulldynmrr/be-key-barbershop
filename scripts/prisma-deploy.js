/**
 * prisma migrate deploy dengan penanganan P3005 (DB tidak kosong tanpa riwayat migrasi).
 *
 * Usage:
 *   node scripts/prisma-deploy.js
 *   node scripts/prisma-deploy.js --baseline-on-p3005
 *   node scripts/prisma-deploy.js --baseline-all-on-p3005
 *
 * --baseline-on-p3005  → tandai semua migrasi KECUALI yang terakhir sebagai sudah diterapkan,
 *                         lalu migrate deploy (menjalankan SQL migrasi terbaru).
 * --baseline-all-on-p3005 → tandai SEMUA migrasi sebagai diterapkan, lalu deploy.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "src", "prisma", "migrations");

function runInherit(cmd) {
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });
}

function runCapture(cmd) {
  try {
    return execSync(cmd, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
  } catch (e) {
    const out = `${e.stdout || ""}${e.stderr || ""}`;
    const err = new Error(out || e.message);
    err.status = e.status;
    throw err;
  }
}

function listMigrationNames() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Folder migrasi tidak ada: ${migrationsDir}`);
    process.exit(1);
  }
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

const baselinePartial =
  process.argv.includes("--baseline-on-p3005") || process.env.PRISMA_BASELINE_ON_P3005 === "1";
const baselineAll =
  process.argv.includes("--baseline-all-on-p3005") || process.env.PRISMA_BASELINE_ALL_ON_P3005 === "1";

if (baselinePartial && baselineAll) {
  console.error("Pilih salah satu: --baseline-on-p3005 atau --baseline-all-on-p3005");
  process.exit(1);
}

let deployOutput = "";
try {
  deployOutput = runCapture("npx prisma migrate deploy");
  if (deployOutput) process.stdout.write(deployOutput);
  console.error("\n[prisma-deploy] migrate deploy berhasil.\n");
  process.exit(0);
} catch (e) {
  deployOutput = e.message || String(e);
}

if (!deployOutput.includes("P3005")) {
  console.error(deployOutput);
  process.exit(1);
}

console.error("\n[prisma-deploy] Terdeteksi P3005: skema DB sudah ada tetapi riwayat Prisma Migrate belum/belum lengkap.\n");

if (!baselinePartial && !baselineAll) {
  console.error("Solusi cepat (DB dev sudah mengikuti migrasi lama, hanya perlu migrasi terbaru):");
  console.error("  npm run db:deploy:baseline\n");
  console.error("Jika DB sudah 100% sama dengan schema Prisma saat ini (termasuk kolom migrasi terbaru):");
  console.error("  npm run db:deploy:baseline-all\n");
  process.exit(1);
}

const names = listMigrationNames();
if (names.length === 0) {
  console.error("Tidak ada folder migrasi.");
  process.exit(1);
}

if (baselineAll) {
  console.error("[prisma-deploy] Menandai semua migrasi sebagai applied (--baseline-all-on-p3005)...\n");
  for (const name of names) {
    runInherit(`npx prisma migrate resolve --applied "${name}"`);
  }
} else if (names.length === 1) {
  console.error("[prisma-deploy] Hanya 1 migrasi: menandai sebagai applied.\n");
  runInherit(`npx prisma migrate resolve --applied "${names[0]}"`);
} else {
  const toMark = names.slice(0, -1);
  console.error(
    `[prisma-deploy] Menandai ${toMark.length} migrasi pertama sebagai applied; lalu deploy migrasi terakhir: ${names[names.length - 1]}\n`,
  );
  for (const name of toMark) {
    runInherit(`npx prisma migrate resolve --applied "${name}"`);
  }
}

console.error("\n[prisma-deploy] migrate deploy (lagi)...\n");
try {
  runInherit("npx prisma migrate deploy");
  console.error("\n[prisma-deploy] Selesai.\n");
  process.exit(0);
} catch (e) {
  console.error(
    "\n[prisma-deploy] Deploy masih gagal. Jika error duplikat kolom/tabel, DB sudah memiliki perubahan migrasi terakhir;",
  );
  console.error("jalankan: npm run db:deploy:baseline-all\n");
  process.exit(e.status || 1);
}
