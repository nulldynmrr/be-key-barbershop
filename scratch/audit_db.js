const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  const userId = '6c06a309-8800-4b51-93c6-996beba0d2d2'; // Based on email context if needed, but let's find by email
  const user = await prisma.user.findFirst({ where: { email: 'onetestt546@gmail.com' } });
  
  if (!user) {
    console.log("User not found");
    return;
  }

  console.log(`--- Audit User: ${user.email} (ID: ${user.id}) ---`);
  console.log(`Current Sisa Credit: ${user.sisa_credit}`);

  const history = await prisma.aIGeneration.findMany({
    where: { user_id: user.id },
    orderBy: { tgl_generate: 'desc' },
    take: 5
  });

  console.log(`\n--- Last 5 History Records ---`);
  history.forEach(h => {
    console.log(`ID: ${h.id} | Date: ${h.tgl_generate} | Cost: ${h.harga_credit_terpakai} | Hash: ${h.image_hash?.slice(0,8)}`);
  });

  const apiLogs = await prisma.systemApiLog.findMany({
    where: { user_id: user.id },
    orderBy: { tgl_penggunaan: 'desc' },
    take: 5
  });

  console.log(`\n--- Last 5 API Logs ---`);
  apiLogs.forEach(l => {
    console.log(`ID: ${l.id} | TS: ${l.timestamp} | Tokens: ${l.total_tokens} | Koin Charged: ${l.koin_charged} | AI Gen ID: ${l.ai_generation_id}`);
  });

  await prisma.$disconnect();
}

audit();
