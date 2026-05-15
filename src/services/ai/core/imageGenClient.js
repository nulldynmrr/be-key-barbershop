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

  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === "image_url" && part.image_url?.url) {
        const u = String(part.image_url.url).replace(/\s/g, "");
        const dataMatch = u.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+=*)/i);
        if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };
        if (u.startsWith("http")) return { type: "url", value: part.image_url.url.trim() };
      }
    }
  }

  if (Array.isArray(msg.images)) {
    for (const img of msg.images) {
      if (img.image_url?.url) {
        const u = String(img.image_url.url).replace(/\s/g, "");
        const dataMatch = u.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+=*)/i);
        if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };
        if (String(img.image_url.url).trim().startsWith("http")) {
          return { type: "url", value: img.image_url.url.trim() };
        }
      }
    }
  }

  if (msg.content && typeof msg.content === "string") {
    const compact = msg.content.replace(/\s/g, "");
    const dataMatch = compact.match(/data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+=*)/i);
    if (dataMatch) return { type: "base64", mime: dataMatch[1].toLowerCase(), value: dataMatch[2] };

    const rawB64 = msg.content.replace(/```[a-z]*\n?/g, "").replace(/\s/g, "").trim();
    if (rawB64.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(rawB64.substring(0, 200))) {
      return { type: "base64", mime: "jpeg", value: rawB64 };
    }

    const mdImgMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (mdImgMatch?.[1]) return { type: "url", value: mdImgMatch[1] };
    const urlMatch = msg.content.match(/(https?:\/\/[^\s]+(?:png|jpe?g|webp|gif|avif)[^\s]*)/i);
    if (urlMatch?.[1]) return { type: "url", value: urlMatch[1] };
  }

  return null;
}

/** Ambil blok usage dari respons chat completions (OpenAI / MAIA). */
function extractUsageFromChatCompletionResponse(data) {
  const top = data?.usage;
  const fromChoice = data?.choices?.[0]?.usage;
  if (top && typeof top === "object" && Object.keys(top).length > 0) return top;
  if (fromChoice && typeof fromChoice === "object" && Object.keys(fromChoice).length > 0) return fromChoice;
  return top || fromChoice || {};
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

  try {
    let limit = userPackage.virtualTryOnLimit > 0 ? userPackage.virtualTryOnLimit : 1;
    if (isFreeTrial) limit = 1;

    if (!hasilAnalisis) {
      throw new Error("Data analisis wajah hilang. Tidak dapat melakukan Virtual Try-On.");
    }
    const rekomendasiGaya = hasilAnalisis.rekomendasi_gaya || [];
    /** Pasangkan nama gaya + alasan LLM agar image model mengikuti rekomendasi, bukan hanya string judul. */
    let styleJobs = rekomendasiGaya.slice(0, limit).map((r) => ({
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
        const response = await axios.post(
          chatCompletionsUrl,
          {
            model: configImageGen.modelName,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: editPrompt },
                  { type: "image_url", image_url: { url: `data:${mimeForDataUrl};base64,${imageBase64}` } },
                ],
              },
            ],
            candidateCount: 1,
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: tryOnAspectRatio, imageSize: "1K" },
          },
          {
            headers: {
              Authorization: `Bearer ${decrypt(configImageGen.apiKey)}`,
              "Content-Type": "application/json",
            },
            timeout: 180000,
          },
        );

        let extractedUrl = null;
        const msg = response.data?.choices?.[0]?.message;

        if (process.env.DEBUG_AI_GRAPH === "1") {
          console.log(`[Image Gen Debug] Response keys:`, Object.keys(response.data || {}));
          console.log(`[Image Gen Debug] choices length:`, response.data?.choices?.length);
          if (msg) {
            console.log(`[Image Gen Debug] msg keys:`, Object.keys(msg));
            console.log(
              `[Image Gen Debug] msg.content type:`,
              typeof msg.content,
              Array.isArray(msg.content) ? `(array, length: ${msg.content.length})` : "",
            );
            if (Array.isArray(msg.content)) {
              msg.content.forEach((part, i) => console.log(`[Image Gen Debug] content[${i}].type:`, part.type));
            }
            if (msg.images) console.log(`[Image Gen Debug] msg.images length:`, msg.images.length);
          } else {
            console.warn(
              `[Image Gen Debug] msg is undefined/null! Full response.data:`,
              JSON.stringify(response.data).substring(0, 500),
            );
          }
        }

        if (msg) {
          let extractedBase64 = null;
          const extracted = extractImageFromChatMessage(msg);
          if (extracted?.type === "base64") extractedBase64 = extracted.value;
          else if (extracted?.type === "url") extractedUrl = extracted.value;

          if (extractedBase64) {
            const genFileName = `tryon-${Date.now()}-${index}-${cleanName.replace(/\.[^.]+$/, "")}.webp`;
            const genFilePath = path.join(process.cwd(), "uploads", "ai_results", genFileName);
            let imgBuffer = Buffer.from(extractedBase64, "base64");
            try {
              imgBuffer = await alignTryOnImageToInput(file.buffer, imgBuffer);
            } catch (orientErr) {
              console.warn("[Image Gen] Orientasi try-on fallback:", orientErr.message);
            }
            const webpBuffer = await sharp(imgBuffer).webp({ quality: 90 }).toBuffer();
            fs.writeFileSync(genFilePath, webpBuffer);
            extractedUrl = `/uploads/ai_results/${genFileName}`;
            if (process.env.DEBUG_AI_GRAPH === "1") {
              console.log(`[Image Gen] Gambar berhasil disimpan: ${extractedUrl}`);
            }
          } else {
            console.warn(`[Image Gen] GAGAL extract gambar untuk gaya '${targetStyle}'. Tidak ada base64/URL yang ditemukan dari response.`);
          }
        }

        const usage = normalizeOpenAiCompatibleUsage(extractUsageFromChatCompletionResponse(response.data));
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

module.exports = { generateVirtualTryOn };
