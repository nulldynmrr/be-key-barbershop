const axios = require("axios");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("../utils/encryption");
const cache = require("../utils/memoryCache");
const { reportSystemError } = require("./alert.service");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const COOLDOWN_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

const userCooldownMap = new Map();

const FEATURE_GATE_MAP = {
  STANDARD_SCAN: "featStandardScan",
  FACE_HEATMAP: "featFaceHeatmap",
  SYMMETRY: "featSymmetry",
  ADV_MAPPING: "featAdvMapping",
  HAIR_ANALYSIS: "featHairAnalysis",
  RISK_ANALYSIS: "featRiskAnalysis",
  BARBER_INSTRUCTIONS: "featBarberInstructions",
  VIRTUAL_TRY_ON: "featVirtualTryOn",
  HISTORY: "featHistory",
  TREND_ANALYSIS: "featTrendAnalysis",
};

const buildDynamicPrompt = (activeFeatures) => {
  const has = (f) => activeFeatures.includes(f);
  const currentYear = new Date().getFullYear();

  const templateFields = [
    `  "kualitas_foto_ok": boolean`,
    `  "alasan_kualitas": string_or_null`,
    `  "jumlah_wajah": number`,
    `  "gender": string`,
    `  "status_rambut": "Botak"|"Tertutup"|"Normal"`,
    `  "bentuk_wajah": string`,
    `  "deskripsi_bentuk_wajah": string`,
    `  "jenis_rambut": string`,
    `  "ketebalan_rambut": string`,
    `  "ai_confidence": number_0_to_100`,
  ];

  const rekomendasiFields = [
    `      "nama_gaya": string`,
    `      "alasan": string`,
    `      "match_score": number_0_to_100`,
  ];

  const systemSections = [];
  const promptSections = [];

  if (has("FACE_HEATMAP")) {
    templateFields.push(
      `  "heatmap_wajah": {`,
      `    "dahi": "High Suitability"|"Medium"|"Low",`,
      `    "pelipis": "High Suitability"|"Medium"|"Low",`,
      `    "pipi": "High Suitability"|"Medium"|"Low",`,
      `    "rahang": "High Suitability"|"Medium"|"Low",`,
      `    "dagu": "High Suitability"|"Medium"|"Low",`,
      `    "zona_terbaik": string,`,
      `    "zona_fokus": string`,
      `  }`
    );
    systemSections.push(
      `- Evaluasi setiap zona wajah (dahi, pelipis, pipi, rahang, dagu) dari sisi kesesuaian gaya rambut: "High Suitability", "Medium", atau "Low". Tentukan zona terbaik dan zona yang perlu perhatian.`
    );
    promptSections.push(
      `- Isi 'heatmap_wajah' dengan level kesesuaian gaya per zona wajah, serta 'zona_terbaik' dan 'zona_fokus'.`
    );
  }

  if (has("SYMMETRY")) {
    templateFields.push(
      `  "skor_simetri": number_0_to_100`,
      `  "level_simetri": "Excellent"|"Good"|"Average"|"Poor"`,
      `  "detail_simetri": {"mata":string,"alis":string,"hidung":string,"mulut":string,"dagu":string}`
    );
    systemSections.push(
      `- Hitung skor simetri wajah (0-100) dengan membandingkan sisi kiri-kanan secara klinis. Beri 'level_simetri' dan evaluasi per area wajah.`
    );
    promptSections.push(
      `- Isi 'skor_simetri' (0-100), 'level_simetri', dan 'detail_simetri' per fitur wajah (Excellent/Good/Average/Poor).`
    );
  }

  if (has("ADV_MAPPING")) {
    templateFields.push(
      `  "peta_proporsi": {"dahi":number,"pipi_kiri":number,"pipi_kanan":number,"rahang":number,"dagu":number}`,
      `  "pengukuran_fitur": {"panjang_wajah":number,"lebar_wajah":number,"kekuatan_rahang":number,"lebar_tulang_pipi":number,"lebar_dahi":number}`,
      `  "keseimbangan_wajah": {"mata_kiri_kanan":string,"alis_kiri_kanan":string,"pemusatan_hidung":string,"kelurusan_mulut":string,"keseimbangan_dagu":string}`
    );
    systemSections.push(
      `- Petakan proporsi wajah per area dalam persentase (0-100). Ukur feature measurements vs proporsi ideal. Evaluasi keseimbangan tiap pasang fitur wajah (Excellent/Good/Average/Poor).`
    );
    promptSections.push(
      `- Isi 'peta_proporsi' (% tiap area), 'pengukuran_fitur' (% vs proporsi ideal), 'keseimbangan_wajah' (kualitas per pasang area).`
    );
  }

  if (has("HAIR_ANALYSIS")) {
    templateFields.push(
      `  "ketebalan_rambut_mm": number`,
      `  "kepadatan_rambut": number_0_to_100`,
      `  "kesehatan_kulit_kepala": number_0_to_100`,
      `  "potensi_pertumbuhan": number_0_to_100`,
      `  "kondisi_rambut": string`,
      `  "rekomendasi_perawatan": string`
    );
    systemSections.push(
      `- Analisis kondisi rambut dan kulit kepala secara klinis: ketebalan rambut (dalam mm, normal 0.08-0.12mm), kepadatan (0-100%), kesehatan kulit kepala (0-100%), potensi pertumbuhan (0-100%). Berikan kondisi rambut saat ini dan rekomendasi perawatan.`
    );
    promptSections.push(
      `- Isi 'ketebalan_rambut_mm', 'kepadatan_rambut', 'kesehatan_kulit_kepala', 'potensi_pertumbuhan' (semua 0-100 kecuali mm), 'kondisi_rambut', dan 'rekomendasi_perawatan'.`
    );
  }

  if (has("RISK_ANALYSIS")) {
    templateFields.push(
      `  "risiko_gaya": {`,
      `    "persentase_risiko": number_0_to_100,`,
      `    "level_risiko": "Low Risk"|"Medium Risk"|"High Risk",`,
      `    "deskripsi_risiko": string,`,
      `    "faktor_risiko": [string]`,
      `  }`
    );
    systemSections.push(
      `- Evaluasi risiko gaya rambut terhadap struktur wajah: seberapa besar kemungkinan gaya utama tidak cocok atau sulit dipertahankan. Beri persentase risiko (0=sangat aman, 100=sangat berisiko), level, deskripsi, dan faktor-faktor risikonya.`
    );
    promptSections.push(
      `- Isi 'risiko_gaya' dengan 'persentase_risiko', 'level_risiko', 'deskripsi_risiko', dan 'faktor_risiko' (array string).`
    );
  }

  if (has("BARBER_INSTRUCTIONS")) {
    templateFields.push(
      `  "instruksi_barber_detail": {`,
      `    "teknik_potong": string,`,
      `    "panjang_sisi": string,`,
      `    "panjang_atas": string,`,
      `    "teknik_finishing": string,`,
      `    "produk_saran": string,`,
      `    "estimasi_waktu": string`,
      `  }`
    );
    systemSections.push(
      `- Buat instruksi teknis lengkap untuk barber berdasarkan gaya terbaik: teknik potong, ukuran panjang sisi dan atas, teknik finishing, saran produk styling, dan estimasi waktu pengerjaan.`
    );
    promptSections.push(
      `- Isi 'instruksi_barber_detail' dengan teknik potong rinci, panjang sisi, panjang atas, teknik finishing, produk saran, dan estimasi waktu.`
    );
  } else {
    templateFields.push(`  "instruksi_barber": string`);
    promptSections.push(`- Isi 'instruksi_barber' dengan instruksi singkat untuk barber.`);
  }

  if (has("TREND_ANALYSIS")) {
    rekomendasiFields.push(
      `      "skor_tren": number_0_to_100`,
      `      "delta_popularitas": string`
    );
    templateFields.push(
      `  "trending_styles": [{"nama":string,"delta":string}]`,
      `  "kompatibilitas_gaya": number_0_to_100`
    );
    systemSections.push(
      `- Rekomendasikan gaya yang PALING TREN di ${currentYear}, cocok dengan bentuk wajah. Sertakan 4 gaya terpopuler dengan delta kenaikan popularitas (contoh: "+24%").`
    );
    promptSections.push(
      `- Tiap rekomendasi tambahkan 'skor_tren' dan 'delta_popularitas'. Isi 'trending_styles' (4 gaya terpopuler ${currentYear}) dan 'kompatibilitas_gaya'.`
    );
  } else {
    systemSections.push(
      `- Rekomendasikan 5 gaya rambut sesuai proporsi wajah. Referensi rentang ${currentYear - 5}–${currentYear}.`
    );
  }

  if (has("VIRTUAL_TRY_ON")) {
    templateFields.push(
      `  "try_on_config": {"gaya_target":string,"instruksi_detail":string,"warna_rambut_saran":string,"estimasi_panjang":string}`
    );
    systemSections.push(
      `- Siapkan konfigurasi virtual try-on: gaya target terbaik, instruksi teknis styling rinci, saran warna rambut paling cocok, dan estimasi panjang rambut. PENTING: Dalam 'instruksi_detail', sertakan juga DESKRIPSI SANGAT DETAIL tentang wajah asli user (gender, bentuk wajah, warna kulit, fitur mata/hidung, pakaian, dan latar belakang) agar AI Image Generator dapat meniru wajah user semirip mungkin!`
    );
    promptSections.push(
      `- Isi 'try_on_config' dengan konfigurasi virtual try-on terbaik untuk wajah ini.`
    );
  }

  const jsonTemplate = `{
${templateFields.join(",\n")},
  "rekomendasi_gaya": [
    {
${rekomendasiFields.join(",\n")}
    }
  ],
  "catatan_stylist": string
}`;

  const systemInstruction = `Kamu adalah AI Master Stylist & Konsultan Morfologi Wajah ${new Date().getFullYear()}. Lakukan analisis MURNI dan KLINIS.
LANGKAH 0: Evaluasi apakah wajah menghadap depan. Jika tidak, set 'kualitas_foto_ok'=false dan isi 'alasan_kualitas'.
PENTING: Jangan ubah identitas wajah. Fokus pada rambut dan struktur wajah.
1. Hitung 'jumlah_wajah'. 2. Periksa 'status_rambut'. 3. Identifikasi 'gender' dan 'bentuk_wajah'.
${systemSections.join("\n")}
Output: JSON murni sesuai template berikut TANPA teks tambahan apapun:
${jsonTemplate}`;

  const promptText = `Lakukan "Face Scan & Haircut Analysis" pada gambar ini.
0. Evaluasi 'kualitas_foto_ok'. Jika tidak pas, isi 'alasan_kualitas'.
1. Isi 'jumlah_wajah', 'status_rambut', 'gender', 'bentuk_wajah', 'deskripsi_bentuk_wajah', 'jenis_rambut', 'ketebalan_rambut', 'ai_confidence'.
2. Isi 'rekomendasi_gaya' dengan 5 gaya rambut diurutkan match_score tertinggi.
3. Isi 'catatan_stylist' dengan insight personal dari stylist AI.
${promptSections.join("\n")}
Kembalikan HANYA JSON murni sesuai template, tidak ada teks lain.`;

  return { systemInstruction, promptText };
};

exports.processFaceAnalysis = async (userId, file, requestedFeatures) => {
  const now = Date.now();
  const lastRequest = userCooldownMap.get(userId);
  if (lastRequest && now - lastRequest < COOLDOWN_MS) {
    const err = new Error(`Terlalu cepat. Tunggu ${Math.ceil((COOLDOWN_MS - (now - lastRequest)) / 1000)} detik lagi.`);
    err.statusCode = 429;
    throw err;
  }
  userCooldownMap.set(userId, now);

  if (userCooldownMap.size > 10000) {
    const cutoff = now - COOLDOWN_MS * 2;
    for (const [uid, ts] of userCooldownMap.entries()) {
      if (ts < cutoff) userCooldownMap.delete(uid);
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    let quality = 80;
    let compressedBuffer = await sharp(file.buffer).webp({ quality }).toBuffer();

    while (compressedBuffer.length > MAX_FILE_SIZE && quality > 20) {
      quality -= 10;
      compressedBuffer = await sharp(file.buffer).webp({ quality }).toBuffer();
    }

    file.buffer = compressedBuffer;
    file.size = compressedBuffer.length;
    file.mimetype = "image/webp";
    file.originalname = file.originalname.replace(/\.[^.]+$/, ".webp");
  }

  const [user, sysConfigFromDb, pricingListFromDb, configAiFromDb, configImageGenFromDb] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        active_package: { include: { llmModel: true, imageModel: true } }
      }
    }),
    cache.get("sysConfig") ? null : prisma.systemConfig.findFirst(),
    cache.get("pricingList") ? null : prisma.featurePricing.findMany(),
    cache.get("configAi") ? null : prisma.aiModel.findFirst({ where: { isActive: true, typeAi: "LLM" } }),
    prisma.aiModel.findFirst({ where: { isActive: true, typeAi: { in: ["IMAGE", "IMAGE_GEN"] } } })
  ]);

  const sysConfig = cache.get("sysConfig") || sysConfigFromDb;
  const pricingList = cache.get("pricingList") || pricingListFromDb;
  const configAi = user?.active_package?.llmModel || cache.get("configAi") || configAiFromDb;
  const configImageGen = user?.active_package?.imageModel || configImageGenFromDb;

  if (sysConfigFromDb) cache.set("sysConfig", sysConfig, 300);
  if (pricingListFromDb) cache.set("pricingList", pricingList, 300);
  if (configAiFromDb) cache.set("configAi", configAi, 300);

  if (!configAi) {
    const err = new Error("Konfigurasi AI belum diatur Admin.");
    err.statusCode = 500;
    throw err;
  }

  let userPackage = user?.active_package;

  if (!userPackage) {
    // If user is FREE and still has their initial credits (at least 1), allow a one-time "Free Trial"
    if (user && user.tipe_akun === 'free' && user.sisa_credit > 0) {
      userPackage = {
        namaPaket: "Free Trial",
        featStandardScan: true,
        featFaceHeatmap: false,
        featSymmetry: false,
        featAdvMapping: false,
        featHairAnalysis: false,
        featRiskAnalysis: false,
        featBarberInstructions: false,
        featVirtualTryOn: true,
        virtualTryOnLimit: 1,
        featHistory: true,
        featTrendAnalysis: false,
        hargaNominal: 750, // Approx 250 per koin
        jumlahKoin: 3,
      };
    } else {
      const err = new Error("Anda belum memiliki paket aktif. Silakan beli paket terlebih dahulu.");
      err.statusCode = 403;
      throw err;
    }
  }

  const isFreeTrial = userPackage.namaPaket === "Free Trial";

  const globalStatus = {};
  for (const fp of pricingList) {
    globalStatus[fp.featureCode] = fp.isActive;
  }

  const activeFeatures = [];
  const deniedByPackage = [];

  for (const feature of requestedFeatures) {
    const code = feature.toUpperCase();
    const col = FEATURE_GATE_MAP[code];
    if (!col) {
      const err = new Error(`Fitur '${feature}' tidak dikenal.`);
      err.statusCode = 400;
      throw err;
    }

    if (globalStatus[code] === false) continue;

    // HARD OVERRIDE FOR FREE TRIAL USERS: Lock premium biometric and detailed features
    // We silenty skip these so the backend doesn't throw "Access Denied", 
    // and the frontend can then show the "Blurred/Locked" UI for missing features.
    const premiumFeatures = [
      "SYMMETRY", "FACE_HEATMAP", "ADV_MAPPING",
      "HAIR_ANALYSIS", "RISK_ANALYSIS",
      "BARBER_INSTRUCTIONS", "TREND_ANALYSIS"
    ];
    if (isFreeTrial && premiumFeatures.includes(code)) {
      continue;
    }

    if (!userPackage[col]) {
      deniedByPackage.push(code);
      continue;
    }

    activeFeatures.push(code);
  }

  if (deniedByPackage.length > 0) {
    const err = new Error(
      `Akses Ditolak: Fitur ${deniedByPackage.map((f) => `'${f}'`).join(", ")} tidak termasuk dalam paket '${userPackage.namaPaket}' Anda.`
    );
    err.statusCode = 403;
    throw err;
  }

  if (!activeFeatures.includes("STANDARD_SCAN")) {
    if (globalStatus["STANDARD_SCAN"] === false) {
      const err = new Error("Fitur analisis dasar (STANDARD_SCAN) sedang dinonaktifkan oleh Admin.");
      err.statusCode = 503;
      throw err;
    }
    activeFeatures.unshift("STANDARD_SCAN");
  }

  let totalKoinFitur = 0;
  for (const code of activeFeatures) {
    const fp = pricingList.find((p) => p.featureCode === code && p.isActive);
    if (fp) totalKoinFitur += fp.koinCost;
  }

  const rateIdr = sysConfig?.baseRateUsdIdr || 16000;
  const multiplier = sysConfig?.globalMultiplier || 1.35;
  const hargaPerKoinIdr = userPackage.jumlahKoin > 0 ? userPackage.hargaNominal / userPackage.jumlahKoin : 250;

  const tarifIn = Number(configAi.hargaInput1M) || 0;
  const tarifOut = Number(configAi.hargaOutput1M) || 0;
  const avgTokens = configAi.avgTokensPerUse || 2000;

  const estCostUsd =
    configAi.pricingUnit === "IMAGE"
      ? (avgTokens / 1_000_000) * tarifIn + (Number(configAi.hargaPerImage) || 0)
      : (avgTokens / 1_000_000) * ((tarifIn + tarifOut) / 2);

  const estCostIdr = estCostUsd * rateIdr * multiplier;
  const estKoinAi = Math.ceil(estCostIdr / hargaPerKoinIdr);
  const minKoinRequired = totalKoinFitur + estKoinAi;

  if (!isFreeTrial && user.sisa_credit < minKoinRequired) {
    const err = new Error(
      `Credit tidak mencukupi. Estimasi butuh ${minKoinRequired} koin (Fitur: ${totalKoinFitur}, Token AI: ${estKoinAi}). Sisa: ${user.sisa_credit}.`
    );
    err.statusCode = 402;
    throw err;
  }

  const decryptedApiKey = decrypt(configAi.apiKey);
  const imageBase64 = file.buffer.toString("base64");
  const cleanName = file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.-]/g, "").substring(0, 50);
  const url_foto_upload = `/uploads/ai_results/${Date.now()}-${cleanName}`;

  const uploadDir = path.join(process.cwd(), "uploads", "ai_results");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filePath = path.join(process.cwd(), url_foto_upload);
  fs.writeFileSync(filePath, file.buffer);

  const { systemInstruction, promptText } = buildDynamicPrompt(activeFeatures);

  let maiaResponse;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      maiaResponse = await axios.post(
        `${configAi.baseUrl}/chat/completions`,
        {
          model: configAi.modelName,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${imageBase64}` } },
              ],
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${decryptedApiKey}` },
          timeout: 120000,
        }
      );
      break;
    } catch (aiError) {
      if (attempt === MAX_RETRIES) {
        reportSystemError(
          "AI_SERVICE",
          `AI call gagal setelah ${MAX_RETRIES}x retry. Model: ${configAi.modelName}. Error: ${aiError.message}. User: ${userId}`,
          "CRITICAL"
        ).catch(() => { });

        const err = new Error(`AI gagal merespons setelah ${MAX_RETRIES} percobaan. Silakan coba lagi nanti.`);
        err.statusCode = 503;
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1] || 5000));
    }
  }

  const hasil_analisis = JSON.parse(maiaResponse.data.choices[0].message.content);
  const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = maiaResponse.data.usage || {};

  const realCostUsd =
    configAi.pricingUnit === "IMAGE"
      ? (prompt_tokens / 1_000_000) * tarifIn + (Number(configAi.hargaPerImage) || 0)
      : (prompt_tokens / 1_000_000) * tarifIn + (completion_tokens / 1_000_000) * tarifOut;

  const realCostIdr = realCostUsd * rateIdr * multiplier;
  const realKoinAi = Math.ceil(realCostIdr / hargaPerKoinIdr);
  let totalDipotong = totalKoinFitur + realKoinAi;

  const saveToHistory = activeFeatures.includes("HISTORY");

  let generatedImageUrls = [];
  let imageGenCostUsd = 0;
  let imageGenUsage = {};

  if (activeFeatures.includes("VIRTUAL_TRY_ON") && configImageGen) {
    try {
      let limit = userPackage.virtualTryOnLimit > 0 ? userPackage.virtualTryOnLimit : 1;

      // Explicitly force 1 image for Free Trial users only
      if (isFreeTrial) {
        limit = 1;
      }
      const rekomendasiGaya = hasil_analisis.rekomendasi_gaya || [];
      const targets = rekomendasiGaya.slice(0, limit).map(r => r.nama_gaya);
      if (targets.length === 0) {
        targets.push(hasil_analisis.try_on_config?.gaya_target || "modern haircut");
      }

      console.log(`[Image Gen] Generating ${targets.length} images in parallel...`);

      const generateImage = async (targetStyle, index) => {
        const editPrompt = `Perform a photorealistic image-to-image transformation.
Task: Change the person's hairstyle to exactly match the "${targetStyle}" style.

Crucial Requirements:
1. NEW HAIRSTYLE: You must completely replace the current hair with the "${targetStyle}". The change must be OBVIOUS and DRAMATIC. Change the hair length, volume, texture, and silhouette to match the new style perfectly. Do not just return the original photo.
2. SAME IDENTITY: The person's face (eyes, nose, mouth, jawline, skin tone) must remain 100% identical. It must look like the exact same person.
3. SAME CONTEXT: Keep the clothing, background, and lighting identical to the original.

Output ONLY the final generated image. Make it look like a real photograph.`;

        try {
          const imageEditResponse = await axios.post(
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
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
              }
            },
            {
              headers: { Authorization: `Bearer ${decrypt(configImageGen.apiKey)}` },
              timeout: 180000,
            }
          );

          let extractedUrl = null;
          let extractedCostUsd = 0;
          const msg = imageEditResponse.data?.choices?.[0]?.message;

          if (msg) {
            let extractedBase64 = null;

            if (msg.content && typeof msg.content === "string") {
              const b64Match = msg.content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
              if (b64Match) extractedBase64 = b64Match[1];
            }
            if (!extractedBase64 && Array.isArray(msg.images)) {
              for (const img of msg.images) {
                if (img.image_url && img.image_url.url) {
                  const dataMatch = img.image_url.url.match(/data:image\/[^;]+;base64,(.+)/);
                  if (dataMatch) {
                    extractedBase64 = dataMatch[1];
                    break;
                  } else if (img.image_url.url.startsWith("http")) {
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
                  if (dataMatch) {
                    extractedBase64 = dataMatch[1];
                    break;
                  } else if (part.image_url.url.startsWith("http")) {
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

          return { url: extractedUrl || url_foto_upload, cost: extractedCostUsd, usage: imageEditResponse.data?.usage || {} };
        } catch (e) {
          console.error(`[Image Gen] Error for target '${targetStyle}':`, e.message);
          return { url: url_foto_upload, cost: 0, usage: {} };
        }
      };

      const results = await Promise.all(targets.map((target, idx) => generateImage(target, idx)));

      generatedImageUrls = results.map(r => r.url);
      imageGenCostUsd = results.reduce((sum, r) => sum + r.cost, 0);

    } catch (e) {
      console.error("Image Gen Overall Error:", e.message);
    }
  }

  let imageGenKoin = 0;
  if (imageGenCostUsd > 0) {
    const imageGenCostIdr = imageGenCostUsd * rateIdr * multiplier;
    imageGenKoin = Math.ceil(imageGenCostIdr / hargaPerKoinIdr);
    totalDipotong += imageGenKoin;
    console.log(`[Image Gen Billing] cost_usd=${imageGenCostUsd}, cost_idr=${imageGenCostIdr.toFixed(2)}, koin=${imageGenKoin}, new_total=${totalDipotong}`);
  }

  const mockTryOnImage = activeFeatures.includes("VIRTUAL_TRY_ON")
    ? generatedImageUrls
    : null;

  const resultTx = await prisma.$transaction(async (tx) => {
    let aiRecord = null;

    if (saveToHistory) {
      aiRecord = await tx.aIGeneration.create({
        data: {
          user_id: userId,
          url_foto_upload,
          url_hasil_img: mockTryOnImage,
          hasil_analisis,
          harga_credit_terpakai: totalDipotong
        },
      });
    }

    await tx.systemApiLog.create({
      data: {
        model_name: configAi.modelName,
        input_tokens: prompt_tokens,
        output_tokens: completion_tokens,
        total_tokens,
        cost_usd: realCostUsd,
        koin_charged: totalKoinFitur + realKoinAi,
        service_fee_koin: totalKoinFitur,
        token_fee_koin: realKoinAi,
        features_used: JSON.stringify(activeFeatures),
        user_id: userId,
        ai_generation_id: aiRecord?.id || null,
      },
    });

    if (imageGenCostUsd > 0 && configImageGen) {
      await tx.systemApiLog.create({
        data: {
          model_name: configImageGen.modelName,
          input_tokens: imageGenUsage.prompt_tokens || 1,
          output_tokens: imageGenUsage.completion_tokens || 1,
          total_tokens: imageGenUsage.total_tokens || 2,
          cost_usd: imageGenCostUsd,
          koin_charged: imageGenKoin,
          service_fee_koin: 0,
          token_fee_koin: imageGenKoin,
          features_used: JSON.stringify(["VIRTUAL_TRY_ON"]),
          user_id: userId,
          ai_generation_id: aiRecord?.id || null,
        },
      });
    }

    // Deduct credits. For Free Trial, we just use up all their initial coins (usually 3) 
    // to prevent them from trying again, but we don't make them go negative.
    const amountToDeduct = isFreeTrial ? user.sisa_credit : totalDipotong;

    await tx.user.update({
      where: { id: userId },
      data: { sisa_credit: { decrement: amountToDeduct } },
    });

    return aiRecord;
  });

  return {
    kualitas_ok: hasil_analisis.kualitas_foto_ok,
    alasan: hasil_analisis.alasan_kualitas || null,
    totalDipotong,
    totalKoinFitur,
    realKoinAi,
    imageGenKoin,
    activeFeatures,
    hasil_analisis,
    resultTx,
    total_tokens,
    realCostUsd,
    url_foto_upload,
    url_hasil_img: mockTryOnImage,
  };
};
