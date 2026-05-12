const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.aiModel.update({
    where: { id: 'c6049f24-7dc4-4008-a3ab-a301c9d47e99' },
    data: { modelName: 'maia/vertex_ai/gemini-2.5-flash-image' }
  });
  console.log("Updated IMAGE_GEN modelName to 'maia/vertex_ai/gemini-2.5-flash-image'");
}
main().finally(() => prisma.$disconnect());
