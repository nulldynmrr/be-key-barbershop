module.exports = {
  templateFields: [
    `  "trending_styles": [{"nama":string,"delta":string}]`,
    `  "kompatibilitas_gaya": number_0_to_100`
  ],
  rekomendasiFields: [
    `      "skor_tren": number_0_to_100`,
    `      "delta_popularitas": string`
  ],
  systemSections: [
    `- Rekomendasikan gaya yang PALING TREN di ${new Date().getFullYear()}, cocok dengan bentuk wajah. Sertakan 4 gaya terpopuler dengan delta kenaikan popularitas (contoh: "+24%").`
  ],
  promptSections: [
    `- Tiap rekomendasi tambahkan 'skor_tren' and 'delta_popularitas'. Isi 'trending_styles' (4 gaya terpopuler ${new Date().getFullYear()}) and 'kompatibilitas_gaya'.`
  ]
};
