const { calculateRealBilling } = require("../services/ai/billing");

/**
 * Verification Script for AI Billing Leakage Fix
 */
function testBilling() {
  const billingBase = {
    rateIdr: 16000,
    multiplier: 1.35,
    hargaPerKoinIdr: 50,
  };

  const configLLM = {
    pricingUnit: "TOKEN",
    hargaInput1M: 0.07,
    hargaOutput1M: 0.3,
  };

  const configImage = {
    pricingUnit: "IMAGE",
    hargaInput1M: 0.3,
    hargaOutput1M: 0,
    hargaPerImage: 0.04,
  };

  console.log("--- Testing LLM Billing ---");
  const llmUsage = { prompt_tokens: 1000, completion_tokens: 500 }; // ~$0.00022
  const llmResult = calculateRealBilling(llmUsage, configLLM, billingBase, 0);
  console.log("LLM Cost USD:", llmResult.realCostUsd);
  console.log("LLM Koin:", llmResult.realKoinAi);
  // Expect: (1000/1M * 0.07) + (500/1M * 0.3) = 0.00007 + 0.00015 = 0.00022 USD
  // 0.00022 * 16000 * 1.35 = 4.752 IDR
  // 4.752 / 50 = 0.095 -> 1 Koin.

  console.log("\n--- Testing Image Billing (The Fix) ---");
  const imageUsage = { prompt_tokens: 1000, completion_tokens: 0 }; // ~$0.0003 tokens + $0.04 fixed
  const imageResult = calculateRealBilling(imageUsage, configImage, billingBase, 0, 1);
  console.log("Image Cost USD:", imageResult.realCostUsd);
  console.log("Image Koin:", imageResult.realKoinAi);
  // Expect: (1000/1M * 0.3) + 0.04 = 0.0003 + 0.04 = 0.0403 USD
  // 0.0403 * 16000 * 1.35 = 870.48 IDR
  // 870.48 / 50 = 17.41 -> 18 Koin.

  if (imageResult.realCostUsd > 0.04) {
    console.log("\n✅ SUCCESS: Image billing now sums tokens and fixed price.");
  } else {
    console.log("\n❌ FAILED: Image billing still skipping fixed price or tokens.");
  }
}

testBilling();
