const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPackage() {
  const pkg = await prisma.subscriptionPackage.findFirst({
    where: { namaPaket: 'IMAGE++' }
  });
  console.log(JSON.stringify(pkg, null, 2));
  await prisma.$disconnect();
}

checkPackage();
