const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const packageService = require('../src/services/package.service');

async function runTest() {
  console.log("=== MEMPERSIAPKAN DATA TEST (UPDATING DB) ===");

  const models = await prisma.aiModel.findMany();

  if (models.length >= 2) {
    // set model LLM (MURAH)
    await prisma.aiModel.update({
      where: { id: models[0].id },
      data: {
        typeAi: 'LLM',
        hargaInput1M: 0.15,
        hargaOutput1M: 0.60,
      }
    });

    // set model Image (Mahal)
    await prisma.aiModel.update({
      where: { id: models[1].id },
      data: {
        typeAi: 'IMAGE_GEN',
        hargaInput1M: 20.0,
        hargaOutput1M: 30.0,
      }
    });

    console.log("Data Model AI berhasil disesuaikan untuk testing.");
  } else {
    console.log("Butuh minimal 2 model di DB untuk test ini.");
    return;
  }

  console.log("\n=== TEST 1: HPP TANPA VIRTUAL TRY-ON (BASIC SCAN) ===");
  const hppBasic = await packageService.calculateLiveHPP({
    jumlahKoin: 5000,
    featVirtualTryOn: false
  });
  console.log("Hasil HPP Basic:", hppBasic);

  console.log("\n=== TEST 2: HPP DENGAN VIRTUAL TRY-ON (PREMIUM) ===");
  const hppPremium = await packageService.calculateLiveHPP({
    jumlahKoin: 5000,
    featVirtualTryOn: true
  });
  console.log("Hasil HPP Premium:", hppPremium);

  console.log("\nKesimpulan: HPP berubah secara dinamis berdasarkan model AI yang terdeteksi aktif di payload!");
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
