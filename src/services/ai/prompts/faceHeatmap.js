module.exports = {
  templateFields: [
    `  "heatmap_wajah": {`,
    `    "dahi": "High Suitability"|"Medium"|"Low",`,
    `    "pelipis": "High Suitability"|"Medium"|"Low",`,
    `    "pipi": "High Suitability"|"Medium"|"Low",`,
    `    "rahang": "High Suitability"|"Medium"|"Low",`,
    `    "dagu": "High Suitability"|"Medium"|"Low",`,
    `    "zona_terbaik": string,`,
    `    "zona_fokus": string`,
    `  }`
  ],
  systemSections: [
    `- Evaluasi setiap zona wajah (dahi, pelipis, pipi, rahang, dagu) dari sisi kesesuaian gaya rambut: "High Suitability", "Medium", atau "Low". Tentukan zona terbaik dan zona yang perlu perhatian.`
  ],
  promptSections: [
    `- Isi 'heatmap_wajah' dengan level kesesuaian gaya per zona wajah, serta 'zona_terbaik' dan 'zona_fokus'.`
  ]
};
