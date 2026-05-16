module.exports = {
  templateFields: [
    `  "ketebalan_rambut": "Tipis"|"Normal"|"Tebal"`,
    `  "ketebalan_rambut_mm": number`,
    `  "kepadatan_rambut": number_0_to_100`,
    `  "kesehatan_kulit_kepala": number_0_to_100`,
    `  "potensi_pertumbuhan": number_0_to_100`,
    `  "kondisi_rambut": string`,
    `  "rekomendasi_perawatan": string`,
  ],
  systemSections: [
    `- KALIBRASI RAMBUT & KULIT KEPALA (estimasi visual, bukan trichogram):
     Ketebalan helai (mm): >0.12 kasar/tebal; 0.08–0.12 normal (referensi umum Asia Tenggara); <0.08 halus/tipis.
     Kepadatan skor 0–100: 80–100 sangat padat (kulit kepala hampir tak terlihat); 60–79 normal; 40–59 menipis area; <40 menipis berat.
     Kulit kepala: nilai dari kilap berlebih, flaking, kemerahan, atau ketidakrataan visual; normal = tanpa tanda mencolok.`,
    `- Analisis kondisi rambut dan kulit kepala: ketebalan (mm), kepadatan (0-100), kesehatan kulit (0-100), potensi pertumbuhan (0-100). Berikan kondisi rambut saat ini dan rekomendasi perawatan.`,
  ],
  promptSections: [
    `- Isi 'ketebalan_rambut_mm', 'kepadatan_rambut', 'kesehatan_kulit_kepala', 'potensi_pertumbuhan' (semua 0-100 kecuali mm), 'kondisi_rambut', dan 'rekomendasi_perawatan'.`,
  ],
};
