const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { decrypt } = require("../../../utils/encryption");
const { reportSystemError } = require("../../alert.service");
const prisma = require("../../../config/prisma");
const { resolveChatCompletionsPostUrl } = require("./openAiUrl");
const { normalizeOpenAiCompatibleUsage } = require("../billing");
const { alignTryOnImageToInput, pickImageAspectRatioForInput } = require("../utils/tryOnImageOrientation");
const { getStyleSilhouetteHint } = require("../utils/tryOnStyleHints");

/** Ekstrak gambar dari satu choice.message (chat completions + image). */
function extractImageFromChatMessage(msg) {
  if (!msg) return null;

  // 1. Native Gemini Format (candidates -> content -> parts -> inline_data)
  if (msg.candidates && Array.isArray(msg.candidates)) {
    for (const cand of msg.candidates) {
      if (cand.content?.parts && Array.isArray(cand.content.parts)) {
        for (const part of cand.content.parts) {
          if (part.inlineData?.data) {
            return { type: "base64", mime: (part.inlineData.mimeType || "image/jpeg").split("/")[1], value: part.inlineData.data };
          }
          if (part.fileData?.fileUri) {
             return { type: "url", value: part.fileData.fileUri };
          }
        }
      }
    }
  }

  // 2. OpenAI Compatible Format (content as array of parts)
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === "image_url" && part.image_url?.url) {
        const u = String(part.image_url.url).replace(/\s/g, "");
        const dataMatch = u.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=_-]+)/i);
        if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };
        if (u.startsWith("http")) return { type: "url", value: part.image_url.url.trim() };
      }
      
      // Gemini native style inside OpenAI-like content (handle both inlineData and inline_data)
      const gData = part.inlineData || part.inline_data;
      if (gData?.data) {
        const mime = (gData.mimeType || gData.mime_type || "image/jpeg").split("/")[1] || "jpeg";
        return { type: "base64", mime: mime.toLowerCase(), value: gData.data };
      }

      // Handle if image is directly in content part (some custom implementations)
      if (part.image && typeof part.image === "string") {
        return { type: "base64", mime: "jpeg", value: part.image };
      }
    }
  }

  // 3. Alternative images field (some routers)
  if (Array.isArray(msg.images)) {
    for (const img of msg.images) {
      const url = typeof img === 'string' ? img : img.image_url?.url || img.url;
      if (url) {
        const u = String(url).replace(/\s/g, "");
        const dataMatch = u.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=_-]+)/i);
        if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };
        if (u.startsWith("http")) return { type: "url", value: url.trim() };
      }
    }
  }

  // 4. Content as string (Markdown or Raw Base64)
  if (msg.content && typeof msg.content === "string") {
    const compact = msg.content.replace(/\s/g, "");
    
    // Scan for any data:image URI
    const dataMatch = compact.match(/data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=_-]{10,})/i);
    if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };

    // Scan for raw base64 that looks like an image (starts with certain headers or is just long and valid)
    // Most JPEGs start with /9j/
    const rawMatch = compact.match(/([A-Za-z0-9+/=_-]{500,})/);
    if (rawMatch?.[1]) {
      const val = rawMatch[1];
      if (val.length > 5000) { // Small enough to be an image, but large enough to not be random text
        return { type: "base64", mime: "jpeg", value: val };
      }
    }

    const mdImgMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (mdImgMatch?.[1]) return { type: "url", value: mdImgMatch[1] };

    const htmlImgMatch = msg.content.match(/<img.*?src=["'](https?:\/\/.*?)["']/i);
    if (htmlImgMatch?.[1]) return { type: "url", value: htmlImgMatch[1] };
  }

  // 5. Root field fallbacks
  if (msg.image && typeof msg.image === "string") {
     const u = msg.image.replace(/\s/g, "");
     const dataMatch = u.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=_-]+)/i);
     if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };
     return { type: "base64", mime: "jpeg", value: msg.image };
  }

  return null;
}

/** Ambil blok usage dari respons chat completions (OpenAI / MAIA). */
function extractUsageFromChatCompletionResponse(data) {
  if (!data || typeof data !== "object") return {};
  
  // Gemini/MAIA root usage
  const top = data.usage;
  if (top && typeof top === "object" && (top.total_tokens || top.prompt_tokens)) return top;
  
  // Alternative root names
  if (data.usageMetadata) return data.usageMetadata;
  
  // OpenAI choices usage
  const fromChoice = data.choices?.[0]?.usage;
  if (fromChoice && typeof fromChoice === "object") return fromChoice;
  
  // Fallback check for any field containing 'token'
  for (const key of Object.keys(data)) {
    if (key.toLowerCase().includes("usage") && typeof data[key] === "object") {
      return data[key];
    }
  }

  return {};
}

/**
 * Virtual Try-On lewat MAIA / OpenAI-compatible **chat completions**
 * (sama pola dengan curl `POST .../v1/chat/completions` + responseModalities TEXT+IMAGE).
 * Endpoint `POST .../v1/images/edits` (multipart) belum dipakai di sini.
 */
const generateVirtualTryOn = async (configImageGen, file, hasilAnalisis, userPackage, isFreeTrial, cleanName, urlFotoUpload) => {
  let generatedImageUrls = [];
  /** Agregat usage nyata dari respons router (per panggilan dijumlahkan). */
  let imageGenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let styleJobs = [];

  try {
    const isMock = decrypt(configImageGen.apiKey) === 'sk-dummy-key';
    if (isMock) {
      console.log(`[MOCK IMAGE GEN] Returning dummy images for testing...`);
      return {
        generatedImageUrls: ["/images/logo-navbar.png"], // Using an existing image as placeholder
        imageGenUsage: { prompt_tokens: 500, completion_tokens: 500, total_tokens: 1000 },
        imageGenAttemptCount: 1,
        imageGenSuccessCount: 1
      };
    }

    let limit = userPackage.virtualTryOnLimit > 0 ? userPackage.virtualTryOnLimit : 1;
    if (isFreeTrial) limit = 1;

    if (!hasilAnalisis) {
      throw new Error("Data analisis wajah hilang. Tidak dapat melakukan Virtual Try-On.");
    }
    const rekomendasiGaya = hasilAnalisis.rekomendasi_gaya || [];
    /** Pasangkan nama gaya + alasan LLM agar image model mengikuti rekomendasi, bukan hanya string judul. */
    styleJobs = rekomendasiGaya.slice(0, limit).map((r) => ({
      nama: String(r?.nama_gaya || "").trim() || "modern haircut",
      alasan: String(r?.alasan || "").trim(),
    }));
    if (styleJobs.length === 0) {
      styleJobs.push({
        nama: String(hasilAnalisis.try_on_config?.gaya_target || "modern haircut").trim(),
        alasan: String(hasilAnalisis.try_on_config?.instruksi_detail || "").trim(),
      });
    }

    const imageBase64 = file.buffer.toString("base64");
    const mimeForDataUrl =
      file.mimetype && /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)
        ? file.mimetype
        : "image/jpeg";
    const chatCompletionsUrl = resolveChatCompletionsPostUrl(configImageGen.baseUrl);
    const tryOnAspectRatio = await pickImageAspectRatioForInput(file.buffer);

    const generateSingleImage = async (job, index) => {
      const targetStyle = job.nama;
      const rekomendasiAlasan = job.alasan;
      // Ambil data try_on_config dari LLM jika tersedia
      const tryOnConfig = hasilAnalisis.try_on_config || {};
      const instruksiDetail = tryOnConfig.instruksi_detail || "";
      const warnaSaran = tryOnConfig.warna_rambut_saran || "";
      const estimasiPanjang = tryOnConfig.estimasi_panjang || "";

      const silhouetteHint =
        getStyleSilhouetteHint(targetStyle) ||
        `Apply the industry-standard haircut silhouette for "${targetStyle}" as used in professional barbering (not a generic portrait).`;

      const editPrompt = `You are a professional hairstyle transformation AI specializing in high-definition (HD) results.

TASK: Transform this person's hairstyle to "${targetStyle}".

STYLE SILHOUETTE (must visually match this named cut — not a random haircut):
${silhouetteHint}

MATCHING CONTEXT FROM FACE ANALYSIS (must be consistent with the haircut choice):
${rekomendasiAlasan ? `- Stylist reasoning: ${rekomendasiAlasan}` : "- (No extra text from analysis; still apply the named style faithfully.)"}

MANDATORY RULES — VIOLATING ANY OF THESE IS A FAILURE:

[RULE 1 — QUALITY & NOISE REDUCTION]
- The input photo may have NOISE or GRAIN (from a camera). You MUST REMOVE this noise.
- The output must be CRYSTAL CLEAR, HIGH DEFINITION, and SHARP.
- Enhance the overall skin texture and hair details to look professional and clean.

[RULE 2 — HAIR MUST CHANGE DRAMATICALLY]
- COMPLETELY REMOVE the current hairstyle from the person's head.
- REPLACE it with the "${targetStyle}" hairstyle.
- The new hairstyle must have visibly DIFFERENT length, volume, texture, and silhouette compared to the original photo.
- If the result looks similar to the original hair, you have FAILED.
${estimasiPanjang ? `- Target hair length: ${estimasiPanjang}.` : ""}
${warnaSaran ? `- Suggested hair color: ${warnaSaran}.` : ""}
${instruksiDetail ? `- Styling details from barber: ${instruksiDetail}` : ""}

[RULE 3 — FACE MUST NOT CHANGE]
- The person's face (eyes, nose, mouth, jawline, skin tone, facial hair) must remain 100% identical.
- DO NOT change the person's identity or facial features.
- It must look like the exact same person, only with a new hairstyle and improved photo quality.

[RULE 4 — CONTEXT MUST NOT CHANGE]
- Keep the body posture and lighting identical to the original photo.
- Only the hair on top of the head changes and the image noise is removed. Nothing else.

[RULE 5 — ORIENTATION (CRITICAL)]
- The output image MUST be upright in the SAME viewing orientation as the input photo (not rotated 90° or tilted).
- Vertical lines of the face (nose bridge, neck) must stay vertical relative to the image frame.
- Do NOT change camera roll or swap portrait/landscape framing relative to the source.

[RULE 6 — FRAMING (CRITICAL — NO BOGUS CROP)]
- The output MUST show the **full head**: forehead hairline, hair on top/crown, and sides as visible in the source — same approximate head scale in the frame.
- NEVER return a tight crop on chin/neck/shoulders only; the new "${targetStyle}" hairstyle must be **fully visible** on the head.

Output ONLY the transformed image. Photorealistic quality. No text, no watermark.`;

      try {
        const isGeminiImage = configImageGen.modelName.includes("gemini") && configImageGen.modelName.includes("image");
        
        const requestBody = {
          model: configImageGen.modelName,
          messages: [
            {
              role: "user",
              content: editPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeForDataUrl};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          candidateCount: 1,
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: tryOnAspectRatio === "1:1" ? "1:1" : (tryOnAspectRatio === "3:4" ? "3:4" : "4:3"),
            imageSize: "1K"
          }
        };

        const response = await axios.post(
          chatCompletionsUrl,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${decrypt(configImageGen.apiKey)}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            timeout: 300000,
          },
        );

        apiCallAttempted = true;
        console.log(`[ImageGen Debug] Received response. Status: ${response.status}`);
        
        const contentType = response.headers['content-type'] || '';
        let responseData;

        if (typeof response.data === 'object') {
          responseData = response.data;
          if (true) {
            console.log(`[ImageGen Debug] JSON RESPONSE keys:`, Object.keys(responseData));
          }
        } else if (contentType.includes('image/')) {
          console.log(`[ImageGen Debug] Received RAW BINARY IMAGE (${contentType})`);
          const b64 = Buffer.isBuffer(response.data) 
            ? response.data.toString('base64') 
            : Buffer.from(response.data).toString('base64');
          responseData = {
            choices: [{
              message: {
                role: "assistant",
                content: `data:${contentType};base64,${b64}`
              }
            }]
          };
        } else {
          try {
            responseData = JSON.parse(response.data.toString());
          } catch (e) {
            responseData = response.data;
          }
        }

        let extractedUrl = null;
        let extractedBase64 = null;

        // [CRITICAL FIX] Try to extract from the entire responseData if choices is missing
        // or extract from choices[0].message if it exists.
        // [CRITICAL FIX] Try to extract from candidates (Native Gemini) or choices (OpenAI)
        const msgObject = responseData?.choices?.[0]?.message || 
                          responseData?.candidates?.[0]?.content ||
                          responseData;

        console.log(`[ImageGen Debug] Processing response for image extraction...`);
        const extracted = extractImageFromChatMessage(msgObject);
        
        // LOG DEBUG: Simpan respons mentah jika ekstraksi gagal
        if (!extracted) {
          const debugPath = path.join(process.cwd(), "scratch", `failed_ext_${Date.now()}.json`);
          fs.writeFileSync(debugPath, JSON.stringify(responseData, null, 2));
          console.log(`[ImageGen Debug] WARNING: Ekstraksi gambar gagal. Respons mentah disimpan di: ${debugPath}`);
        }
        
        if (extracted) {
          console.log(`[ImageGen Debug] Extracted Type:`, extracted.type);
          if (extracted.type === "base64") extractedBase64 = extracted.value;
          else if (extracted.type === "url") extractedUrl = extracted.value;
        }

        if (extractedBase64) {
            console.log(`[ImageGen Debug] Base64 length:`, extractedBase64.length);
            const safeCleanName = (cleanName || "image").replace(/\.[^.]+$/, "");
            const genFileName = `tryon-${Date.now()}-${index}-${safeCleanName}.webp`;
            const genFilePath = path.join(process.cwd(), "uploads", "ai_results", genFileName);
            
            let imgBuffer = Buffer.from(extractedBase64, "base64");
            console.log(`[ImageGen Debug] Buffer created, size:`, imgBuffer.length);

            try {
              console.log(`[ImageGen Debug] Aligning image...`);
              imgBuffer = await alignTryOnImageToInput(file.buffer, imgBuffer);
            } catch (orientErr) {
              console.warn("[Image Gen] Orientasi try-on fallback:", orientErr.message);
            }

            console.log(`[ImageGen Debug] Converting to WebP via Sharp...`);
            let webpBuffer;
            try {
              webpBuffer = await sharp(imgBuffer).webp({ quality: 90 }).toBuffer();
              console.log(`[ImageGen Debug] Sharp conversion success, size:`, webpBuffer.length);
            } catch (sharpErr) {
              console.error(`[ImageGen Debug] Sharp conversion FAILED:`, sharpErr.message);
              // Fallback: simpan raw buffer jika sharp gagal (untuk investigasi)
              const rawFileName = `failed-${Date.now()}-${index}.raw`;
              fs.writeFileSync(path.join(process.cwd(), "uploads", "ai_results", rawFileName), imgBuffer);
              throw new Error(`Sharp failed to process image: ${sharpErr.message}`);
            }
            
            console.log(`[ImageGen Debug] Writing file to:`, genFilePath);
            fs.writeFileSync(genFilePath, webpBuffer);
            
            extractedUrl = `/uploads/ai_results/${genFileName}`;
            console.log(`[ImageGen Debug] SUCCESS! URL:`, extractedUrl);
          } else {
            console.error(`[ImageGen Debug] FAILED! No image found in response.`);
            console.log(`[ImageGen Debug] Object keys:`, Object.keys(msgObject || {}));
            if (msgObject && msgObject.content) {
              console.log(`[ImageGen Debug] Content (truncated):`, JSON.stringify(msgObject.content).substring(0, 1000));
            }
          }

        const usage = normalizeOpenAiCompatibleUsage(extractUsageFromChatCompletionResponse(responseData));
        return {
          url: extractedUrl || null,
          usage,
        };
      } catch (e) {
        const errorBody = e.response?.data?.error || {};
        const errorMsg = errorBody.message || e.message;
        console.error(`[Image Gen] Error for target '${targetStyle}':`, e.response?.data || e.message);

        // Deteksi budget habis 
        if (errorBody.type === "budget_exceeded" || errorMsg.includes("Budget has been exceeded")) {
          const budgetMatch = errorMsg.match(/Max budget:\s*([\d.]+)/i);
          const realMaxBudget = budgetMatch ? parseFloat(budgetMatch[1]) : null;

          const updateData = { isActive: false }; // Auto-nonaktifkan model yang sudah habis
          if (realMaxBudget !== null) updateData.maxBudget = realMaxBudget;

          prisma.aiModel.update({
            where: { id: configImageGen.id },
            data: updateData,
          }).then(() => {
            console.log(`[Budget Sync] Model ${configImageGen.modelName} dinonaktifkan. maxBudget disinkron ke $${realMaxBudget}`);
          }).catch((dbErr) => {
            console.error("[Budget Sync] Gagal update DB:", dbErr.message);
          });

          reportSystemError(
            "IMAGE_GEN_BUDGET",
            `💸 Budget API HABIS & Model Dinonaktifkan!\nModel: ${configImageGen.modelName}\nBudget provider: $${realMaxBudget || '?'}\n\n👉 Top-up sekarang: https://dash.maiarouter.ai/dashboard\n\nSetelah top-up, aktifkan kembali model di Dashboard > AI Config.`,
            "CRITICAL"
          ).catch(() => { });

          const err = new Error(`Layanan AI sedang dalam pemeliharaan. Tim kami sedang menanganinya.`);
          err.statusCode = 503;
          err.errorCode = "SERVICE_UNAVAILABLE";
          throw err;
        }

        const fallbackTokens = Number(configImageGen.avgTokensPerUse) || 2000;
        return { 
          url: null, 
          usage: { prompt_tokens: fallbackTokens, completion_tokens: 0, total_tokens: fallbackTokens },
          apiCallAttempted: true
        };
      }
    };

    const results = await Promise.all(styleJobs.map((job, idx) => generateSingleImage(job, idx)));

    generatedImageUrls = results.map((r) => r.url).filter(Boolean);
    console.log(`[ImageGen Debug] TOTAL IMAGES GENERATED:`, generatedImageUrls.length);
    if (generatedImageUrls.length === 0 && results.length > 0) {
      console.warn(`[ImageGen Debug] WARNING: No images were successfully generated/extracted from ${results.length} attempts!`);
    }
    results.forEach((r) => {
      imageGenUsage.prompt_tokens += r.usage?.prompt_tokens || 0;
      imageGenUsage.completion_tokens += r.usage?.completion_tokens || 0;
      imageGenUsage.total_tokens += r.usage?.total_tokens || 0;
    });
    if (
      !imageGenUsage.total_tokens &&
      (imageGenUsage.prompt_tokens || imageGenUsage.completion_tokens)
    ) {
      imageGenUsage.total_tokens = imageGenUsage.prompt_tokens + imageGenUsage.completion_tokens;
    }

  } catch (e) {
    console.error("Image Gen Overall Error:", e.message);
    if (e.errorCode === "SERVICE_UNAVAILABLE" || e.statusCode === 503) {
      throw e;
    }
  }

  return { 
    generatedImageUrls, 
    imageGenUsage,
    imageGenAttemptCount: styleJobs.length,
    imageGenSuccessCount: generatedImageUrls.length
  };
};

module.exports = { generateVirtualTryOn, extractImageFromChatMessage };
