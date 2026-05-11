module.exports = {
  templateFields: [
    `  "skor_simetri": number_0_to_100`,
    `  "level_simetri": "Excellent"|"Good"|"Average"|"Poor"`,
    `  "detail_simetri": {"mata":string,"alis":string,"hidung":string,"mulut":string,"dagu":string}`
  ],
  systemSections: [
    `- Hitung skor simetri wajah (0-100) dengan membandingkan sisi kiri-kanan secara klinis. Beri 'level_simetri' dan evaluasi per area wajah.`
  ],
  promptSections: [
    `- Isi 'skor_simetri' (0-100), 'level_simetri', dan 'detail_simetri' per fitur wajah (Excellent/Good/Average/Poor).`
  ]
};
