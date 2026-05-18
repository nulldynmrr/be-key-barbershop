const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkData() {
  const models = await prisma.aiModel.findMany();
  console.log("=== AI MODELS ===");
  models.forEach(m => console.log(`- ID: ${m.id} | ${m.namaRouter} (${m.modelName}): type=${m.typeAi}, active=${m.isActive}`));

  const packages = await prisma.subscriptionPackage.findMany();
  console.log("\n=== PACKAGES ===");
  packages.forEach(p => console.log(`- ID: ${p.id} | ${p.namaPaket}: tryOn=${p.featVirtualTryOn}, limit=${p.virtualTryOnLimit}, imageModelId=${p.imageModelId}`));
}

checkData().catch(console.error).finally(() => prisma.$disconnect());
