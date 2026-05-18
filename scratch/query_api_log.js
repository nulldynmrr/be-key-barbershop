const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.systemApiLog.findMany({
    orderBy: { tgl_penggunaan: 'desc' },
    take: 5,
    select: { id: true, model_name: true, attempt_count: true, success_count: true, cost_usd: true, tgl_penggunaan: true }
  });
  console.log(JSON.stringify(logs, null, 2));
}
main().finally(() => prisma.$disconnect());
