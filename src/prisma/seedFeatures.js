const prisma = require("../config/prisma");

async function seedNewFeatures() {
  const newFeatures = [
    {
      featureCode: "FACE_HEATMAP",
      namaFitur: "Face Heatmap Visualization",
      koinCost: 3,
      isActive: true,
    },
    {
      featureCode: "HAIR_ANALYSIS",
      namaFitur: "Hair & Scalp Analysis",
      koinCost: 5,
      isActive: true,
    },
    {
      featureCode: "RISK_ANALYSIS",
      namaFitur: "Hairstyle Risk Analysis",
      koinCost: 3,
      isActive: true,
    },
    {
      featureCode: "BARBER_INSTRUCTIONS",
      namaFitur: "Barber Instruction Detail",
      koinCost: 2,
      isActive: true,
    },
  ];

  for (const feature of newFeatures) {
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

  console.log("[SEED] Done seeding new feature pricing.");
  await prisma.$disconnect();
}

seedNewFeatures().catch((e) => {
  console.error(e);
  process.exit(1);
});
