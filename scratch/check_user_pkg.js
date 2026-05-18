const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserPackage() {
  const user = await prisma.user.findUnique({
    where: { id: '3afff8e5-d925-4ea0-a0b6-54ace9433270' },
    include: { active_package: true }
  });
  console.log(JSON.stringify(user.active_package, null, 2));
  await prisma.$disconnect();
}

checkUserPackage();
