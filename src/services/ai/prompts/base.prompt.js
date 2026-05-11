module.exports = {
  templateFields: [
    `  "kualitas_foto_ok": boolean`,
    `  "alasan_kualitas": string_or_null`,
    `  "jumlah_wajah": number`,
    `  "gender": string`,
    `  "status_rambut": "Botak"|"Tertutup"|"Normal"`,
    `  "bentuk_wajah": string`,
    `  "deskripsi_bentuk_wajah": string`,
    `  "jenis_rambut": string`,
    `  "ketebalan_rambut": string`,
    `  "ai_confidence": number_0_to_100`,
  ],
  rekomendasiFields: [
    `      "nama_gaya": string`,
    `      "alasan": string`,
    `      "match_score": number_0_to_100`,
  ],
  systemInstructions: (year) => [
    `Kamu adalah Ahli Gaya & Barber Master di Key Barber tahun ${year}.`,
    `Tugasmu adalah memberikan saran gaya rambut terbaik yang membuat pelanggan merasa percaya diri.`,
    `LANGKAH 0: Evaluasi apakah wajah menghadap depan. Jika tidak, set 'kualitas_foto_ok'=false dan isi 'alasan_kualitas'.`,
    `PENTING: Jangan ubah identitas wajah. Fokus pada rambut dan struktur wajah.`,
    `1. Hitung 'jumlah_wajah'. 2. Periksa 'status_rambut'. 3. Identifikasi 'gender' dan 'bentuk_wajah'.`
  ],
  promptTexts: [
    `Lakukan "Face Scan & Haircut Analysis" pada gambar ini.`,
    `0. Evaluasi 'kualitas_foto_ok'. Jika tidak pas, isi 'alasan_kualitas'.`,
    `1. Isi 'jumlah_wajah', 'status_rambut', 'gender', 'bentuk_wajah', 'deskripsi_bentuk_wajah', 'jenis_rambut', 'ketebalan_rambut', 'ai_confidence'.`,
    `2. Isi 'rekomendasi_gaya' dengan 5 gaya rambut diurutkan match_score tertinggi.`,
    `3. Isi 'catatan_stylist' dengan insight personal dari stylist AI.`
  ]
};
