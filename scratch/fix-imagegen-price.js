const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixImageGenModels() {
  const imageModels = await prisma.aiModel.findMany({ where: { typeAi: 'IMAGE_GEN' } });
  
  console.log(`Ditemukan ${imageModels.length} model IMAGE_GEN. Memperbarui hargaInput1M...`);

  for (const m of imageModels) {
    console.log(`\n  Model: ${m.namaRouter}`);
    console.log(`  hargaInput1M saat ini: $${m.hargaInput1M}`);
    console.log(`  hargaPerImage saat ini: $${m.hargaPerImage}`);

    // Hanya update jika hargaInput1M masih 0 (bukan sudah diisi manual)
    if (m.hargaInput1M === 0 || m.hargaInput1M === null) {
      await prisma.aiModel.update({
        where: { id: m.id },
        data: { hargaInput1M: 0.30 }  // Sesuai screenshot: $0.30 / 1M tokens
      });
      console.log(`  ✅ hargaInput1M diupdate ke $0.30`);
    } else {
      console.log(`  ⏭️  Dilewati (hargaInput1M sudah terisi)`);
    }
  }

  console.log('\nSelesai!');
}

fixImageGenModels()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
