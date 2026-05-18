const hairTrends2026 = require("../data/hairTrends2026");

const trendLines = hairTrends2026.globalTrends2026
  .map((t) => `• [${t.category}] ${t.nama}: ${t.delta} (Gender: ${t.gender}, Wajah: ${t.cocok_wajah.join(", ")}, Tekstur: ${t.cocok_rambut.join(", ")})`)
  .join("\n     ");

module.exports = {
  templateFields: [
    `  "trending_styles": [{"nama":string,"delta":string}]`,
    `  "kompatibilitas_gaya": number_0_to_100`,
    `  "analisis_tren_lokal": string`,
    `  "alasan_biometrik_tren": string`,
  ],
  rekomendasiFields: [
    `      "skor_tren": number_0_to_100`,
    `      "delta_popularitas": string`,
  ],
  systemSections: [
    `- SISTEM CERDAS MATCHING 2026 (Wajib jadi acuan tunggal; JANGAN gunakan template):
     ${trendLines}
     
     PROTOKOL ANALISIS PREMIUM:
     1. IDENTIFIKASI GENDER & BIOMETRIK: Pastikan gender, bentuk wajah, dan jenis rambut klien terdeteksi akurat.
     2. CROSS-REFERENCE: Hanya pilih tren dari daftar di atas yang memenuhi kriteria Gender, Wajah, DAN Tekstur Rambut klien.
     3. DIVERSITAS ANTI-TEMPLATE: DILARANG KERAS memberikan 'Textured Crop' (Pria) atau 'Shaggy Layer' (Wanita) jika ada opsi lain yang lebih cocok dengan biometrik klien. 
     4. JUSTIFIKASI BIOMETRIK: Jelaskan di 'alasan_biometrik_tren' mengapa tren tersebut dipilih berdasarkan kombinasi unik bentuk wajah dan jenis rambut klien (misal: "Karena rambut Anda ikal tebal, Warrior Cut lebih cocok daripada Textured Crop untuk menjaga volume").`,
    `- Hubungkan tren di atas dengan fitur biometrik klien. Jelaskan analisis tren lokal secara menyeluruh di 'analisis_tren_lokal'.`,
  ],
  promptSections: [
    `- Tiap rekomendasi tambahkan 'skor_tren' dan 'delta_popularitas'. Isi 'trending_styles' (4 gaya dari daftar referensi) dan 'kompatibilitas_gaya'.`,
  ],
};
