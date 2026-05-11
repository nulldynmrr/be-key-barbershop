module.exports = {
  templateFields: [
    `  "instruksi_barber_detail": {`,
    `    "teknik_potong": string,`,
    `    "panjang_sisi": string,`,
    `    "panjang_atas": string,`,
    `    "teknik_finishing": string,`,
    `    "produk_saran": string,`,
    `    "estimasi_waktu": string`,
    `  }`
  ],
  systemSections: [
    `- Buat instruksi teknis lengkap untuk barber berdasarkan gaya terbaik: teknik potong, ukuran panjang sisi dan atas, teknik finishing, saran produk styling, dan estimasi waktu pengerjaan.`
  ],
  promptSections: [
    `- Isi 'instruksi_barber_detail' dengan teknik potong rinci, panjang sisi, panjang atas, teknik finishing, produk saran, dan estimasi waktu.`
  ]
};
