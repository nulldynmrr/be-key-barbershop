const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = "e1f4f327-77ec-49c7-a360-e90b8343cf28";
  console.log(`Checking AIGeneration for user: ${userId}`);
  
  const generations = await prisma.aIGeneration.findMany({
    where: { user_id: userId },
    orderBy: { tgl_generate: 'desc' },
    take: 5
  });

  console.log(JSON.stringify(generations, null, 2));
  process.exit();
}

check();
