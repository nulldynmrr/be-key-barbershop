require('dotenv').config();
const axios = require("axios");
const { decrypt } = require("../src/utils/encryption");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { extractImageFromChatMessage } = require("../src/services/ai/core/imageGenClient");
const sharp = require("sharp");

const prisma = new PrismaClient();

async function debug() {
  const model = await prisma.aiModel.findFirst({ where: { typeAi: "IMAGE_GEN", isActive: true } });
  if (!model) { console.log("No active image model"); process.exit(); }

  const apiKey = decrypt(model.apiKey);
  const url = model.baseUrl + "/chat/completions";

  const uploadDir = path.join(process.cwd(), "uploads", "ai_results");
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith(".webp") || f.endsWith(".jpg"));
  if (files.length === 0) { console.log("No images to test with"); process.exit(); }
  
  const testImgPath = path.join(uploadDir, files[0]);
  const base64 = fs.readFileSync(testImgPath).toString("base64");

  console.log("Testing with model:", model.modelName);

  try {
    const res = await axios.post(url, {
      model: model.modelName,
      messages: [
        {
          role: "user",
          content: "Transform this person with a modern buzz cut hairstyle. Photorealistic."
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }
      ],
      candidateCount: 1,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K"
      }
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 120000
    });

    console.log("Status:", res.status);
    fs.writeFileSync("scratch/full_debug.json", JSON.stringify(res.data, null, 2));
    
    const msgObject = res.data?.choices?.[0]?.message || res.data?.candidates?.[0]?.content || res.data;
    const extracted = extractImageFromChatMessage(msgObject);
    if (!extracted) {
      console.log("Extraction returned null!");
      process.exit();
    }
    
    console.log("Extracted Type:", extracted.type);
    if (extracted.type === "base64") {
       console.log("Base64 length:", extracted.value.length);
       let imgBuffer = Buffer.from(extracted.value, "base64");
       console.log("Buffer size:", imgBuffer.length);
       fs.writeFileSync("scratch/extracted.raw", imgBuffer);
       
       console.log("Running sharp...");
       try {
         const webp = await sharp(imgBuffer).webp({ quality: 90 }).toBuffer();
         console.log("Sharp Success! WebP size:", webp.length);
       } catch (err) {
         console.error("Sharp FAILED:", err.message);
       }
    }
    
  } catch (e) {
    console.error("Error:", e.response?.data || e.message);
  }
  process.exit();
}

debug();
