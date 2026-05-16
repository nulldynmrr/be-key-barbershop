module.exports = {
  templateFields: [
    `  "kualitas_foto_ok": boolean`,
    `  "alasan_kualitas": string_or_null`,
    `  "jumlah_wajah": number`,
    `  "gender": "Wanita"|"Pria"`,
    `  "status_rambut": "Botak"|"Tertutup"|"Normal"`,
    `  "bentuk_wajah": "Oval"|"Bulat"|"Kotak"|"Hati"|"Diamond"|"Lonjong"`,
    `  "deskripsi_bentuk_wajah": string`,
    `  "jenis_rambut": string`,
    `  "ai_confidence": number_0_to_100`,
    `  "saran_khusus": string`,
  ],
  rekomendasiFields: [
    `      "nama_gaya": string`,
    `      "alasan": string`,
    `      "match_score": number_0_to_100`,
  ],
  systemInstructions: (year) => [
    `Kamu adalah Ahli Gaya & Barber Master di Key Barber tahun ${year}.`,
    `PANDUAN GENDER KRITIS: Lakukan identifikasi gender dengan sangat teliti. Jika subjek adalah wanita, berikan rekomendasi gaya rambut wanita yang elegan. JANGAN memberikan gaya rambut pria kepada wanita. BEGITU SEBALIKNYA`,
    `Tugasmu adalah memberikan saran gaya rambut terbaik yang membuat pelanggan merasa percaya diri.`,
    `LANGKAH 0: Analisis Kualitas & Deteksi Wajah.`,
    `Tugas utamamu adalah mendeteksi keberadaan wajah manusia yang menghadap depan.`,
    `HANYA tetapkan 'kualitas_foto_ok': false jika subjek bukan manusia, wajah membelakangi kamera, atau wajah tertutup secara total.`,
    `PENTING: JANGAN ubah identitas wajah. Fokus pada analisis rambut dan proporsi wajah asli.`,
    `'jenis_rambut' WAJIB diisi deskriptif (bukan kosong, bukan "-"): contoh "Lurus pendek", "Ikal longgar", "Keriting rapat", "Lurus halus fine".`,
    `1. Hitung 'jumlah_wajah'. 2. Periksa 'status_rambut'. 3. Identifikasi 'gender' dan 'bentuk_wajah'. 4. Tentukan 'jenis_rambut' dan berikan 'saran_khusus'.`
  ],
  promptTexts: [
    `Lakukan analisis biometrik wajah lengkap dan berikan rekomendasi gaya rambut.`,
    `INSTRUKSI KRITIS:`,
    `- Identifikasi GENDER dengan sangat teliti (Pria/Wanita). JANGAN SALAH.`,
    `- 'jenis_rambut' WAJIB string deskriptif minimal 3 kata (tekstur + pola, mis. "Lurus halus medium", "Ikal longgar volume sedang").`,
    `- WAJIB BERIKAN TEPAT 5 'rekomendasi_gaya' yang sesuai dengan gender subjek.`,
    `- OUTPUT HARUS HANYA JSON MURNI TANPA TEKS LAIN.`,
    `- Gunakan bahasa Indonesia yang profesional untuk deskripsi dan alasan.`
  ]
};
