const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
  } catch (e) {
    console.error("❌ Database connection failed:");
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
