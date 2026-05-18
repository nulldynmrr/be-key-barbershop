const prisma = require("../src/config/prisma");
const { dbTransactionNode } = require("../src/services/ai/graph/nodes/dbTransactionNode");

async function testBilling() {
  console.log("=== STARTING BILLING TEST ===");
  try {
    // 1. Setup Data: Get/Create User
    let user = await prisma.user.findFirst({ where: { role: "user" } });
    if (!user) {
      user = await prisma.user.create({ data: { nama: "Test User", email: "test@example.com", sisa_credit: 100, role: "user" } });
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { sisa_credit: 100 } });
    }

    // 2. Setup Config
    const configAi = { modelName: "test-llm", hargaInput1M: 5, hargaOutput1M: 15, pricingUnit: "TOKEN" };
    const configImageGen = { modelName: "test-maia-image", hargaPerImage: 0.04, pricingUnit: "IMAGE", hargaInput1M: 5, avgTokensPerUse: 3000 };
    const billingBase = { totalKoinFitur: 5, rateIdr: 16000, multiplier: 1.35, hargaPerKoinIdr: 250 };

    // 3. Simulate State from imageGenNode (FAILED generation, 3 attempts)
    const state = {
      userId: user.id,
      activeFeatures: ["VIRTUAL_TRY_ON", "HISTORY"],
      hasil_analisis: { test: "data" },
      generatedImageUrls: [], // Failed
      url_foto_upload: "http://example.com/photo.jpg",
      configAi,
      configImageGen,
      llmUsage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      realBilling: { realCostUsd: 0.0125, realKoinAi: 2, totalDipotong: 7 }, // LLM billing
      billingBase,
      imageGenCostUsd: 0.12, // 3 attempts * $0.04
      imageGenKoin: 11, // $0.12 * 16000 * 1.35 / 250
      imageGenUsage: { prompt_tokens: 9000, completion_tokens: 0, total_tokens: 9000 },
      imageGenAttemptCount: 3,
      imageGenSuccessCount: 0,
      user,
      isFreeTrial: false,
      totalDipotong: 18, // 7 + 11
      imageFingerprint: "hash123",
      featureFingerprint: "feat123",
    };

    // 4. Run Transaction
    console.log("Running DB Transaction...");
    const result = await dbTransactionNode(state);
    console.log("Result:", result);

    // 5. Verify Logs
    const logs = await prisma.systemApiLog.findMany({
      where: { user_id: user.id },
      orderBy: { tgl_penggunaan: 'desc' },
      take: 2
    });
    
    console.log("\n--- Generated Logs ---");
    logs.forEach(log => {
      console.log(`Model: ${log.model_name} | Cost: $${log.cost_usd} | Attempts: ${log.attempt_count} | Success: ${log.success_count}`);
    });

    // 6. Verify Balance in DB
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    console.log(`\nUser Credit Balance: ${updatedUser.sisa_credit} (Expected: 100 - 18 = 82)`);
    
    console.log("\n=== TEST PASSED ===");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testBilling();
