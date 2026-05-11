module.exports = {
  templateFields: [
    `  "ketebalan_rambut_mm": number`,
    `  "kepadatan_rambut": number_0_to_100`,
    `  "kesehatan_kulit_kepala": number_0_to_100`,
    `  "potensi_pertumbuhan": number_0_to_100`,
    `  "kondisi_rambut": string`,
    `  "rekomendasi_perawatan": string`
  ],
  systemSections: [
    `- Analisis kondisi rambut dan kulit kepala secara klinis: ketebalan rambut (dalam mm, normal 0.08-0.12mm), kepadatan (0-100%), kesehatan kulit kepala (0-100%), potensi pertumbuhan (0-100%). Berikan kondisi rambut saat ini dan rekomendasi perawatan.`
  ],
  promptSections: [
    `- Isi 'ketebalan_rambut_mm', 'kepadatan_rambut', 'kesehatan_kulit_kepala', 'potensi_pertumbuhan' (semua 0-100 kecuali mm), 'kondisi_rambut', dan 'rekomendasi_perawatan'.`
  ]
};
