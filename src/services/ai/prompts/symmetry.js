module.exports = {
  templateFields: [
    `  "skor_simetri": number_0_to_100`,
    `  "level_simetri": "Excellent"|"Good"|"Average"|"Poor"`,
    `  "detail_simetri": {"mata":string,"alis":string,"hidung":string,"mulut":string,"dagu":string}`,
  ],
  systemSections: [
    `- KALIBRASI SIMETRI (wajib): Ini estimasi visual, bukan pengukuran landmark — gunakan skala konsisten:
     - 90–100 = sangat simetris (wajah sangat seimbang, minoritas populasi)
     - 75–89  = baik / normal sehat (mayoritas orang tanpa asimetri mencolok)
     - 60–74  = asimetri ringan (terlihat jika difoto frontal ketat)
     - <60    = asimetri signifikan (mata/alis/sudut mulut jelas tidak sejajar)
     Aturan: tanpa tanda asimetri jelas, skor tidak boleh di bawah 70. Asimetri minor umumnya 75–85.
     Evaluasi mental (bobot sama): tinggi mata kiri-kanan; lengkung alis; sudut mulut; lebar pipi/zygoma; pusat hidung.`,
    `- Hitung skor simetri wajah (0-100) dengan membandingkan sisi kiri-kanan secara klinis. Beri 'level_simetri' dan evaluasi per area wajah.`,
  ],
  promptSections: [
    `- Isi 'skor_simetri' (0-100), 'level_simetri', dan 'detail_simetri' per fitur wajah (Excellent/Good/Average/Poor).`,
  ],
};
