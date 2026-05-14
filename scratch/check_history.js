const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const lastHistory = await prisma.aIGeneration.findMany({
    orderBy: { tgl_generate: 'desc' },
    take: 5,
    include: { user: true }
  });
  console.log(JSON.stringify(lastHistory, null, 2));
  await prisma.$disconnect();
}

check();
