const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const logs = await prisma.systemApiLog.findMany({
    orderBy: { tgl_penggunaan: 'desc' },
    take: 10
  });
  console.log(logs);
}
run().catch(console.error).finally(() => prisma.$disconnect());
