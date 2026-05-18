module.exports = {
  templateFields: [
    `  "peta_proporsi": {"dahi":number,"pipi_kiri":number,"pipi_kanan":number,"rahang":number,"dagu":number}`,
    `  "pengukuran_fitur": {"panjang_wajah":number,"lebar_wajah":number,"kekuatan_rahang":number,"lebar_tulang_pipi":number,"lebar_dahi":number}`,
    `  "keseimbangan_wajah": {"mata_kiri_kanan":string,"alis_kiri_kanan":string,"pemusatan_hidung":string,"kelurusan_mulut":string,"keseimbangan_dagu":string}`,
  ],
  systemSections: [
    `- KALIBRASI PROPORSI & RAHANG (estimasi relatif dari foto frontal):
     'peta_proporsi' dan 'pengukuran_fitur' adalah indeks relatif 0–100 terhadap proporsi wajah dewasa rata-rata dalam frame yang sama (bukan milimeter nyata).
     kekuatan_rahang: 0 = dagu sangat lunak/tidak tegas; 50 = rata-rata; 100 = sudut rahang sangat tegas/kuat secara visual.`,
    `- Petakan proporsi wajah per area dalam persentase (0-100). Ukur feature measurements vs proporsi ideal. Evaluasi keseimbangan tiap pasang fitur wajah (Excellent/Good/Average/Poor).`,
  ],
  promptSections: [
    `- Isi 'peta_proporsi' (% tiap area), 'pengukuran_fitur' (% vs proporsi ideal), 'keseimbangan_wajah' (kualitas per pasang area).`,
  ],
};
