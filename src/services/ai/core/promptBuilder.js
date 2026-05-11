const basePrompt = require("../prompts/base.prompt");

/**
 * Merakit prompt dinamis berdasarkan fitur yang aktif.
 * @param {string[]} activeFeatures 
 * @returns {object} { systemInstruction, promptText }
 */
const buildDynamicPrompt = (activeFeatures) => {
  const currentYear = new Date().getFullYear();
  const templateFields = [...basePrompt.templateFields];
  const rekomendasiFields = [...basePrompt.rekomendasiFields];
  const systemSections = [];
  const promptSections = [];

  // Helper to load and merge feature prompts
  const addFeature = (featureKey, fileName) => {
    if (activeFeatures.includes(featureKey)) {
      try {
        const feature = require(`../prompts/${fileName}`);
        if (feature.templateFields) templateFields.push(...feature.templateFields);
        if (feature.rekomendasiFields) rekomendasiFields.push(...feature.rekomendasiFields);
        if (feature.systemSections) systemSections.push(...feature.systemSections);
        if (feature.promptSections) promptSections.push(...feature.promptSections);
      } catch (err) {
        console.error(`Error loading prompt for feature ${featureKey}:`, err.message);
      }
    }
  };

  // List of features and their corresponding prompt files
  addFeature("FACE_HEATMAP", "faceHeatmap");
  addFeature("SYMMETRY", "symmetry");
  addFeature("ADV_MAPPING", "advMapping");
  addFeature("HAIR_ANALYSIS", "hairAnalysis");
  addFeature("RISK_ANALYSIS", "riskAnalysis");
  addFeature("BARBER_INSTRUCTIONS", "barberInstructions");
  addFeature("TREND_ANALYSIS", "trendAnalysis");
  addFeature("VIRTUAL_TRY_ON", "virtualTryOn");

  // Fallback if BARBER_INSTRUCTIONS is not active
  if (!activeFeatures.includes("BARBER_INSTRUCTIONS")) {
    templateFields.push(`  "instruksi_barber": string`);
    promptSections.push(`- Isi 'instruksi_barber' dengan instruksi singkat untuk barber.`);
  }

  // Fallback if TREND_ANALYSIS is not active
  if (!activeFeatures.includes("TREND_ANALYSIS")) {
    systemSections.push(
      `- Rekomendasikan 5 gaya rambut sesuai proporsi wajah. Referensi rentang ${currentYear - 5}–${currentYear}.`
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

  const systemInstruction = `${basePrompt.systemInstructions(currentYear).join("\n")}
${systemSections.join("\n")}
Output: JSON murni sesuai template berikut TANPA teks tambahan apapun:
${jsonTemplate}`;

  const promptText = `${basePrompt.promptTexts.slice(0, 3).join("\n")}
${basePrompt.promptTexts[3]}
${basePrompt.promptTexts[4]}
${promptSections.join("\n")}
Kembalikan HANYA JSON murni sesuai template, tidak ada teks lain.`;

  return { systemInstruction, promptText };
};

module.exports = { buildDynamicPrompt };
