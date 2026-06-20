const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    take: 5
  });
  console.log("Users:", users.map(u => ({ id: u.id, email: u.email, role: u.role, name: u.nama })));
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
