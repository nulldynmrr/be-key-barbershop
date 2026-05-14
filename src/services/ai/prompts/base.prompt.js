module.exports = {
  templateFields: [
    `  "kualitas_foto_ok": boolean`,
    `  "alasan_kualitas": string_or_null`,
    `  "jumlah_wajah": number`,
    `  "gender": "Wanita"|"Pria"`,
    `  "status_rambut": "Botak"|"Tertutup"|"Normal"`,
    `  "bentuk_wajah": "Oval"|"Bulat"|"Kotak"|"Hati"|"Diamond"|"Lonjong"`,
    `  "deskripsi_bentuk_wajah": string`,
    `  "skor_simetri": number_0_to_100`,
    `  "level_simetri": string`,
    `  "keseimbangan_wajah": { "mata_kiri_kanan": string, "alis_kiri_kanan": string, "pemusatan_hidung": string, "kelurusan_mulut": string }`,
    `  "heatmap_wajah": { "dahi": string, "pipi": string, "rahang": string, "dagu": string, "zona_terbaik": string }`,
    `  "peta_proporsi": { "dahi": number, "pipi_kiri": number, "pipi_kanan": number, "rahang": number, "dagu": number }`,
    `  "pengukuran_fitur": { "panjang_wajah": number, "kekuatan_rahang": number, "lebar_tulang_pipi": number, "lebar_dahi": number, "lebar_wajah": number }`,
    `  "jenis_rambut": string`,
    `  "ketebalan_rambut": "Tipis"|"Normal"|"Tebal"`,
    `  "kepadatan_rambut": number_0_to_100`,
    `  "kesehatan_kulit_kepala": number_0_to_100`,
    `  "ai_confidence": number_0_to_100`,
  ],
  rekomendasiFields: [
    `      "nama_gaya": string`,
    `      "alasan": string`,
    `      "match_score": number_0_to_100`,
  ],
  systemInstructions: (year) => [
    `Kamu adalah Ahli Gaya & Barber Master di Key Barber tahun ${year}.`,
    `PANDUAN GENDER KRITIS: Lakukan identifikasi gender dengan sangat teliti. Jika subjek adalah wanita, berikan rekomendasi gaya rambut wanita yang elegan. JANGAN memberikan gaya rambut pria kepada wanita.`,
    `Tugasmu adalah memberikan saran gaya rambut terbaik yang membuat pelanggan merasa percaya diri.`,
    `LANGKAH 0: Analisis Kualitas & Deteksi Wajah.`,
    `Tugas utamamu adalah mendeteksi keberadaan wajah manusia yang menghadap depan.`,
    `HANYA tetapkan 'kualitas_foto_ok': false jika subjek bukan manusia, wajah membelakangi kamera, atau wajah tertutup secara total.`,
    `PENTING: JANGAN ubah identitas wajah. Fokus pada analisis rambut dan proporsi wajah asli.`,
    `'jenis_rambut' WAJIB diisi deskriptif (bukan kosong, bukan "-"): contoh "Lurus pendek", "Ikal longgar", "Keriting rapat", "Lurus halus fine".`,
    `1. Hitung 'jumlah_wajah'. 2. Periksa 'status_rambut'. 3. Identifikasi 'gender' dan 'bentuk_wajah'.`
  ],
  promptTexts: [
    `Lakukan analisis biometrik wajah lengkap dan berikan rekomendasi gaya rambut.`,
    `INSTRUKSI KRITIS:`,
    `- Identifikasi GENDER dengan sangat teliti (Pria/Wanita). JANGAN SALAH.`,
    `- WAJIB ISI SEMUA FIELD: 'skor_simetri', 'heatmap_wajah', 'peta_proporsi', 'pengukuran_fitur', 'kepadatan_rambut', 'potensi_pertumbuhan', 'instruksi_barber_detail'.`,
    `- 'jenis_rambut' WAJIB string deskriptif minimal 3 kata (tekstur + pola, mis. "Lurus halus medium", "Ikal longgar volume sedang").`,
    `- WAJIB BERIKAN TEPAT 5 'rekomendasi_gaya' yang sesuai dengan gender subjek.`,
    `- OUTPUT HARUS HANYA JSON MURNI TANPA TEKS LAIN.`,
    `- Gunakan bahasa Indonesia yang profesional untuk deskripsi dan alasan.`
  ]
};
