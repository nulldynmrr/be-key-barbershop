const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("--- AI MODELS ---");
  const models = await prisma.aiModel.findMany();
  console.log(JSON.stringify(models, null, 2));

  console.log("\n--- API LOG AGGREGATES ---");
  const usages = await prisma.systemApiLog.groupBy({
    by: ["model_name"],
    _sum: { cost_usd: true },
  });
  console.log(JSON.stringify(usages, null, 2));

  console.log("\n--- PACKAGES ---");
  const packages = await prisma.subscriptionPackage.findMany({
    include: {
      llmModel: true,
      imageModel: true,
    }
  });
  console.log(JSON.stringify(packages.map(p => ({
    id: p.id,
    namaPaket: p.namaPaket,
    llmModelId: p.llmModelId,
    imageModelId: p.imageModelId,
    status: p.status,
    featVirtualTryOn: p.featVirtualTryOn
  })), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
