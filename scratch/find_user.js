const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUser() {
  const users = await prisma.user.findMany({
    where: { email: { contains: 'onetest' } },
    select: { email: true, id: true, sisa_credit: true }
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

findUser();
