const hairTrends2026 = require("../data/hairTrends2026");

const trendLines = hairTrends2026.globalTrends2026
  .map((t) => `• ${t.nama}: ${t.delta} (${t.region}) — sumber ringkas: ${t.source}`)
  .join("\n     ");

module.exports = {
  templateFields: [
    `  "trending_styles": [{"nama":string,"delta":string}]`,
    `  "kompatibilitas_gaya": number_0_to_100`,
  ],
  rekomendasiFields: [
    `      "skor_tren": number_0_to_100`,
    `      "delta_popularitas": string`,
  ],
  systemSections: [
    `- DATA TREN TERKURASI (wajib jadi acuan utama; jangan mengarang nama tren di luar daftar kecuali variasi penamaan sangat mirip salah satu entri):
     ${trendLines}
     Pilih 4–5 entri yang paling kompatibel dengan bentuk wajah klien. Jangan merekomendasikan gaya yang jelas bentrok dengan struktur wajah (jelaskan alasannya di JSON jika menolak suatu tren).`,
    `- Hubungkan tren di atas dengan bentuk wajah klien. 'delta' pada output harus konsisten dengan referensi (boleh menyalin atau merujuk persis).`,
  ],
  promptSections: [
    `- Tiap rekomendasi tambahkan 'skor_tren' dan 'delta_popularitas'. Isi 'trending_styles' (4 gaya dari daftar referensi) dan 'kompatibilitas_gaya'.`,
  ],
};
