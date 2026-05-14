const basePrompt = require("../prompts/base.prompt");
const systemPersona = require("../prompts/systemPersona");
const { FEATURE_PROMPTS, FEATURE_PROMPT_LOAD_ORDER } = require("../prompts/featurePromptRegistry");

/**
 * @param {string[]} activeFeatures
 * @param {{ staleRefreshPreviousAnalysis?: object | null, staleRefreshPeriodDays?: number }} [options]
 * @returns {{ systemInstruction: string, promptText: string }}
 */
const buildDynamicPrompt = (activeFeatures, options = {}) => {
  const { staleRefreshPreviousAnalysis, staleRefreshPeriodDays = 30 } = options;
  const currentYear = new Date().getFullYear();
  const templateFields = [...basePrompt.templateFields];
  const rekomendasiFields = [...basePrompt.rekomendasiFields];
  const systemSections = [];
  const promptSections = [];

  // Merge prompt modul fitur (require statis lewat featurePromptRegistry.js)
  for (const featureKey of FEATURE_PROMPT_LOAD_ORDER) {
    if (!activeFeatures.includes(featureKey)) continue;
    try {
      const feature = FEATURE_PROMPTS[featureKey];
      if (!feature) {
        console.error(`[promptBuilder] Tidak ada modul prompt untuk fitur: ${featureKey}`);
        continue;
      }
      if (feature.templateFields) templateFields.push(...feature.templateFields);
      if (feature.rekomendasiFields) rekomendasiFields.push(...feature.rekomendasiFields);
      if (feature.systemSections) systemSections.push(...feature.systemSections);
      if (feature.promptSections) promptSections.push(...feature.promptSections);
    } catch (err) {
      console.error(`Error loading prompt for feature ${featureKey}:`, err.message);
    }
  }

  // Fallback if BARBER_INSTRUCTIONS is not active
  if (!activeFeatures.includes("BARBER_INSTRUCTIONS")) {
    templateFields.push(`  "instruksi_barber": string`);
    promptSections.push(`- Isi 'instruksi_barber' dengan instruksi singkat untuk barber.`);
  }

  // Fallback if TREND_ANALYSIS is not active
  if (!activeFeatures.includes("TREND_ANALYSIS")) {
    systemSections.push(
      `- Rekomendasikan 5 gaya rambut sesuai proporsi wajah. Referensi rentang ${currentYear - 5}–${currentYear}.`,
    );
  }

  if (staleRefreshPreviousAnalysis && typeof staleRefreshPreviousAnalysis === "object") {
    const prev = staleRefreshPreviousAnalysis;
    const prevNames = (prev.rekomendasi_gaya || [])
      .slice(0, 4)
      .map((r) => r?.nama_gaya)
      .filter(Boolean);
    const prevNamesStr = prevNames.length ? prevNames.join(", ") : "(tidak ada)";
    systemSections.unshift(
      `- KONTEKS ANALISIS ULANG (foto & paket fitur sama; entri history lama tetap ada di DB — ini generasi baru):
       Jeda paket untuk refresh hasil sama ≈ ${staleRefreshPeriodDays} hari (sesuai langganan / kebijakan cache).
       Data wajah yang sudah pernah dianalisis (pegang konsistensi; jangan ubah kecuali foto jelas beda):
       - bentuk_wajah: ${JSON.stringify(prev.bentuk_wajah ?? "")}
       - skor_simetri: ${prev.skor_simetri ?? "n/a"}
       - ketebalan_rambut_mm: ${prev.ketebalan_rambut_mm ?? "n/a"}
       TUGAS: Berikan rekomendasi gaya BARU yang berbeda dari siklus sebelumnya. Hindari mengulang nama gaya: ${prevNamesStr}.
       Angka biometrik utama (simetri, mm rambut, kepadatan) harus konsisten dengan data di atas kecuali ada alasan kuat dari foto.`,
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

  const systemInstruction = `
${systemPersona.persona || ""}
${systemPersona.voiceCharacteristics || ""}
${typeof systemPersona.copywritingRules === "string" ? systemPersona.copywritingRules : systemPersona.copywritingRules?.join("\n") || ""}
${systemPersona.barberInstructions || ""}

${basePrompt.systemInstructions(currentYear).join("\n")}
${systemSections.join("\n")}

Output: JSON murni sesuai template berikut TANPA teks tambahan apapun:
${jsonTemplate}`;

  const promptText = `
${basePrompt.promptTexts.join("\n")}
${promptSections.join("\n")}

Kembalikan HANYA JSON murni sesuai template, tidak ada teks lain.`;

  return { systemInstruction, promptText };
};

module.exports = { buildDynamicPrompt };
