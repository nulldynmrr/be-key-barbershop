const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seedFeatures() {
  const features = [
    { code: "STANDARD_SCAN", name: "Face Shape Analysis" },
    { code: "FACE_HEATMAP", name: "Face Heatmap" },
    { code: "SYMMETRY", name: "Face Symmetry Analysis" },
    { code: "ADV_MAPPING", name: "Advanced Facial Mapping" },
    { code: "HAIR_ANALYSIS", name: "Hair Type & Texture Analysis" },
    { code: "RISK_ANALYSIS", name: "Scalp & Hair Risk Analysis" },
    { code: "BARBER_INSTRUCTIONS", name: "Detailed Barber Instructions" },
    { code: "VIRTUAL_TRY_ON", name: "AI Virtual Try-On" },
    { code: "HISTORY", name: "Analysis History" },
    { code: "TREND_ANALYSIS", name: "Personal Style Trend Analysis" },
  ];

  for (const f of features) {
    await prisma.featurePricing.upsert({
      where: { featureCode: f.code },
      update: {},
      create: {
        featureCode: f.code,
        namaFitur: f.name,
        koinCost: f.code === "VIRTUAL_TRY_ON" ? 0 : 0, // Costs are now part of package logic but we can set 0
        isActive: true
      }
    });
  }
  console.log("Features seeded successfully.");
}

seedFeatures().catch(console.error).finally(() => prisma.$disconnect());
