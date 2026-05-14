const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const activeModel = await prisma.aiModel.findFirst({
    where: { isActive: true, typeAi: 'LLM' }
  });
  console.log("Active LLM Model:", JSON.stringify(activeModel, null, 2));
  await prisma.$disconnect();
}

check();
