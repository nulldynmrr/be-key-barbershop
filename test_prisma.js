const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        tipe_akun: true,
        sisa_credit: true,
        status_langganan: true,
        tgl_berakhir_langganan: true,
        createdAt: true,
        active_package: {
          select: {
            namaPaket: true
          }
        }
      }
    });
    console.log(user);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
