const prisma = require("../src/config/prisma");
const { FEATURE_GATE_MAP } = require("../src/services/ai/featureGateMap");

async function testGetFeatures() {
  const userId = "e1f4f327-77ec-49c7-a360-e90b8343cf28";
  
  const pricingList = await prisma.featurePricing.findMany({ orderBy: { featureCode: "asc" } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { active_package: true },
  });
  
  const userPackage = user?.active_package || null;
  console.log("User Account Type:", user?.tipe_akun);
  console.log("Active Package Name:", userPackage?.namaPaket);

  const features = {};
  for (const fp of pricingList) {
    const col = FEATURE_GATE_MAP[fp.featureCode];
    const globallyActive = fp.isActive;
    const inPackage = userPackage ? !!userPackage[col] : false;
    
    console.log(`Feature: ${fp.featureCode}, Col: ${col}, Value in Pkg: ${userPackage ? userPackage[col] : 'N/A'}`);
    
    features[fp.featureCode] = {
      namaFitur: fp.namaFitur,
      available: globallyActive && inPackage,
    };
  }

  console.log("Final Features Available:", JSON.stringify(features, null, 2));
  process.exit(0);
}

testGetFeatures();
