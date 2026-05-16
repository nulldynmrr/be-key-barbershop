const prisma = require("../src/config/prisma");

async function seedFeaturePricing() {
  const features = [
    { featureCode: "STANDARD_SCAN", namaFitur: "Standard Face Scan", koinCost: 0, isActive: true },
    { featureCode: "FACE_HEATMAP", namaFitur: "Facial Feature Heatmap", koinCost: 0, isActive: true },
    { featureCode: "SYMMETRY", namaFitur: "Face Symmetry Analysis", koinCost: 0, isActive: true },
    { featureCode: "ADV_MAPPING", namaFitur: "Advanced Facial Mapping", koinCost: 0, isActive: true },
    { featureCode: "HAIR_ANALYSIS", namaFitur: "Hair Texture & Growth Analysis", koinCost: 0, isActive: true },
    { featureCode: "RISK_ANALYSIS", namaFitur: "Scalp & Hair Risk Assessment", koinCost: 0, isActive: true },
    { featureCode: "BARBER_INSTRUCTIONS", namaFitur: "Detailed Barber Instructions", koinCost: 0, isActive: true },
    { featureCode: "VIRTUAL_TRY_ON", namaFitur: "Virtual Hairstyle Try-On", koinCost: 0, isActive: true },
    { featureCode: "HISTORY", namaFitur: "AI Analysis History", koinCost: 0, isActive: true },
    { featureCode: "TREND_ANALYSIS", namaFitur: "Personalized Trend Matching", koinCost: 0, isActive: true },
  ];

  console.log("Seeding FeaturePricing...");

  for (const f of features) {
    await prisma.featurePricing.upsert({
      where: { featureCode: f.featureCode },
      update: f,
      create: f,
    });
    console.log(`- Seeded ${f.featureCode}`);
  }

  console.log("Seeding completed.");
  process.exit(0);
}

seedFeaturePricing();
