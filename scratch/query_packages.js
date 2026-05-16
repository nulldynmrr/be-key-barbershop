require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Show all packages
  const pkgs = await prisma.subscriptionPackage.findMany({
    take: 10,
    select: {
      id: true, namaPaket: true, jumlahKoin: true, hargaNominal: true, status: true,
      featStandardScan: true, featFaceHeatmap: true, featSymmetry: true, featAdvMapping: true,
      featHairAnalysis: true, featRiskAnalysis: true, featBarberInstructions: true,
      featVirtualTryOn: true, featHistory: true, featTrendAnalysis: true, virtualTryOnLimit: true,
    }
  });
  console.log('=== PACKAGES ===');
  console.log(JSON.stringify(pkgs, null, 2));

  // Show sample users
  const users = await prisma.user.findMany({
    take: 3,
    select: {
      id: true, nama_lengkap: true, sisa_credit: true, tipe_akun: true,
      paket_id: true,
      active_package: { select: { namaPaket: true, jumlahKoin: true, featBarberInstructions: true, featHairAnalysis: true } }
    }
  });
  console.log('\n=== SAMPLE USERS ===');
  console.log(JSON.stringify(users, null, 2));
}
main().finally(() => prisma.$disconnect());
