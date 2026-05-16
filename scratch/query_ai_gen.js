const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.aIGeneration.findMany({
    orderBy: { tgl_generate: 'desc' },
    take: 5,
    select: { id: true, url_hasil_img: true, url_foto_upload: true, tgl_generate: true }
  });
  console.log(JSON.stringify(rows, null, 2));
}
main().finally(() => prisma.$disconnect());
