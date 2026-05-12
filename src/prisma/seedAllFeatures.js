require("dotenv").config({ path: __dirname + '/../../.env' });
const prisma = require("../config/prisma");

async function seedAllFeatures() {
  const allFeatures = [
    { featureCode: "STANDARD_SCAN", namaFitur: "Basic Scan", koinCost: 1, isActive: true },
    { featureCode: "FACE_HEATMAP", namaFitur: "Face Heatmap", koinCost: 2, isActive: true },
    { featureCode: "SYMMETRY", namaFitur: "Symmetry Analysis", koinCost: 2, isActive: true },
    { featureCode: "ADV_MAPPING", namaFitur: "Advanced Mapping", koinCost: 3, isActive: true },
    { featureCode: "HAIR_ANALYSIS", namaFitur: "Hair Analysis", koinCost: 3, isActive: true },
    { featureCode: "RISK_ANALYSIS", namaFitur: "Risk Analysis", koinCost: 2, isActive: true },
    { featureCode: "BARBER_INSTRUCTIONS", namaFitur: "Barber Instructions", koinCost: 2, isActive: true },
    { featureCode: "VIRTUAL_TRY_ON", namaFitur: "Virtual Try-On", koinCost: 10, isActive: true },
    { featureCode: "HISTORY", namaFitur: "History", koinCost: 1, isActive: true },
    { featureCode: "TREND_ANALYSIS", namaFitur: "Trend Analysis", koinCost: 4, isActive: true },
  ];

  for (const feature of allFeatures) {
    const existing = await prisma.featurePricing.findUnique({
      where: { featureCode: feature.featureCode },
    });

    if (!existing) {
      await prisma.featurePricing.create({ data: feature });
      console.log(`[SEED] Created: ${feature.featureCode}`);
    } else {
      console.log(`[SKIP] Already exists: ${feature.featureCode}`);
    }
  }

  console.log("[SEED] Done seeding all feature pricing.");
}

seedAllFeatures()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
