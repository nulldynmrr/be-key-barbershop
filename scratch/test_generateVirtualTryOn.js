require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { generateVirtualTryOn } = require("../src/services/ai/core/imageGenClient");

const prisma = new PrismaClient();

async function debug() {
  const model = await prisma.aiModel.findFirst({ where: { typeAi: "IMAGE_GEN", isActive: true } });
  if (!model) { console.log("No active image model"); process.exit(); }

  const uploadDir = path.join(process.cwd(), "uploads", "ai_results");
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith(".webp") || f.endsWith(".jpg"));
  if (files.length === 0) { console.log("No images to test with"); process.exit(); }
  
  const testImgPath = path.join(uploadDir, files[0]);
  const buffer = fs.readFileSync(testImgPath);

  console.log("Testing generateVirtualTryOn with model:", model.modelName);

  const mockFile = { buffer, mimetype: "image/webp" };
  const mockHasil = {
    rekomendasi_gaya: [
      { nama_gaya: "Textured Crop", alasan: "Good for oval face" }
    ],
    try_on_config: {}
  };
  const mockUserPackage = { virtualTryOnLimit: 1 };

  try {
    const result = await generateVirtualTryOn(
      model,
      mockFile,
      mockHasil,
      mockUserPackage,
      false,
      "test-clean-name",
      "/uploads/ai_results/test.webp"
    );

    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Main Error:", e);
  }
  
  if (fs.existsSync("scratch/image_gen_error.txt")) {
     console.log("\n--- ERROR LOG CONTENT ---");
     console.log(fs.readFileSync("scratch/image_gen_error.txt", "utf8"));
  }
  
  process.exit();
}

debug();
