const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { decrypt } = require("../../../utils/encryption");

/**
 * Eksekusi Virtual Try-On Image Generation.
 */
const generateVirtualTryOn = async (configImageGen, file, hasilAnalisis, userPackage, isFreeTrial, cleanName, urlFotoUpload) => {
  let generatedImageUrls = [];
  let imageGenCostUsd = 0;
  let imageGenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  try {
    let limit = userPackage.virtualTryOnLimit > 0 ? userPackage.virtualTryOnLimit : 1;
    if (isFreeTrial) limit = 1;

    const rekomendasiGaya = hasilAnalisis.rekomendasi_gaya || [];
    const targets = rekomendasiGaya.slice(0, limit).map(r => r.nama_gaya);
    if (targets.length === 0) {
      targets.push(hasilAnalisis.try_on_config?.gaya_target || "modern haircut");
    }

    const imageBase64 = file.buffer.toString("base64");

    const generateSingleImage = async (targetStyle, index) => {
      const editPrompt = `Perform a photorealistic image-to-image transformation.
Task: Change the person's hairstyle to exactly match the "${targetStyle}" style.

Crucial Requirements:
1. NEW HAIRSTYLE: You must completely replace the current hair with the "${targetStyle}". The change must be OBVIOUS and DRAMATIC. Change the hair length, volume, texture, and silhouette to match the new style perfectly. Do not just return the original photo.
2. SAME IDENTITY: The person's face (eyes, nose, mouth, jawline, skin tone) must remain 100% identical. It must look like the exact same person.
3. SAME CONTEXT: Keep the clothing, background, and lighting identical to the original.

Output ONLY the final generated image. Make it look like a real photograph.`;

      try {
        const response = await axios.post(
          `${configImageGen.baseUrl}/chat/completions`,
          {
            model: configImageGen.modelName,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: editPrompt },
                  { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${imageBase64}` } },
                ],
              },
            ],
            candidateCount: 1,
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
          },
          {
            headers: { Authorization: `Bearer ${decrypt(configImageGen.apiKey)}` },
            timeout: 180000,
          }
        );

        let extractedUrl = null;
        let extractedCostUsd = 0;
        const msg = response.data?.choices?.[0]?.message;

        if (msg) {
          let extractedBase64 = null;

          // Parsing Logic (SAMA PERSIS)
          if (msg.content && typeof msg.content === "string") {
            const b64Match = msg.content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
            if (b64Match) extractedBase64 = b64Match[1];
          }
          if (!extractedBase64 && Array.isArray(msg.images)) {
            for (const img of msg.images) {
              if (img.image_url?.url) {
                const dataMatch = img.image_url.url.match(/data:image\/[^;]+;base64,(.+)/);
                if (dataMatch) { extractedBase64 = dataMatch[1]; break; }
                else if (img.image_url.url.startsWith("http")) {
                  extractedUrl = img.image_url.url;
                  extractedCostUsd = Number(configImageGen.hargaPerImage) || 0;
                  break;
                }
              }
            }
          }
          if (!extractedBase64 && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "image_url" && part.image_url?.url) {
                const dataMatch = part.image_url.url.match(/data:image\/[^;]+;base64,(.+)/);
                if (dataMatch) { extractedBase64 = dataMatch[1]; break; }
                else if (part.image_url.url.startsWith("http")) {
                  extractedUrl = part.image_url.url;
                  extractedCostUsd = Number(configImageGen.hargaPerImage) || 0;
                  break;
                }
              }
            }
          }
          if (!extractedBase64 && msg.content && typeof msg.content === "string") {
            const rawB64 = msg.content.replace(/```[a-z]*\n?/g, "").replace(/\n/g, "").trim();
            if (rawB64.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(rawB64.substring(0, 100))) {
              extractedBase64 = rawB64;
            }
          }
          if (!extractedBase64 && !extractedUrl && msg.content && typeof msg.content === "string") {
            const mdImgMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
            if (mdImgMatch && mdImgMatch[1]) {
              extractedUrl = mdImgMatch[1];
              extractedCostUsd = Number(configImageGen.hargaPerImage) || 0;
            } else {
              const urlMatch = msg.content.match(/(https?:\/\/[^\s]+(?:png|jpe?g|webp|gif|avif)[^\s]*)/i);
              if (urlMatch && urlMatch[1]) {
                extractedUrl = urlMatch[1];
                extractedCostUsd = Number(configImageGen.hargaPerImage) || 0;
              }
            }
          }

          if (extractedBase64) {
            const genFileName = `tryon-${Date.now()}-${index}-${cleanName.replace(/\.[^.]+$/, "")}.webp`;
            const genFilePath = path.join(process.cwd(), "uploads", "ai_results", genFileName);
            const imgBuffer = Buffer.from(extractedBase64, "base64");
            const webpBuffer = await sharp(imgBuffer).webp({ quality: 90 }).toBuffer();
            fs.writeFileSync(genFilePath, webpBuffer);
            extractedUrl = `/uploads/ai_results/${genFileName}`;
            extractedCostUsd = Number(configImageGen.hargaPerImage) || 0;
          }
        }

        return { 
          url: extractedUrl || urlFotoUpload, 
          cost: extractedCostUsd, 
          usage: response.data?.usage || {} 
        };
      } catch (e) {
        console.error(`[Image Gen] Error for target '${targetStyle}':`, e.message);
        return { url: urlFotoUpload, cost: 0, usage: {} };
      }
    };

    const results = await Promise.all(targets.map((target, idx) => generateSingleImage(target, idx)));

    generatedImageUrls = results.map(r => r.url);
    imageGenCostUsd = results.reduce((sum, r) => sum + r.cost, 0);
    // Aggregate usage
    results.forEach(r => {
      imageGenUsage.prompt_tokens += (r.usage?.prompt_tokens || 0);
      imageGenUsage.completion_tokens += (r.usage?.completion_tokens || 0);
      imageGenUsage.total_tokens += (r.usage?.total_tokens || 0);
    });

  } catch (e) {
    console.error("Image Gen Overall Error:", e.message);
  }

  return { generatedImageUrls, imageGenCostUsd, imageGenUsage };
};

module.exports = { generateVirtualTryOn };
