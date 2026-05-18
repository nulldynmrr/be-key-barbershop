module.exports = {
  templateFields: [
    `  "try_on_config": {"gaya_target":string,"instruksi_detail":string,"warna_rambut_saran":string,"estimasi_panjang":string}`
  ],
  systemSections: [
    `- Siapkan konfigurasi virtual try-on: gaya target terbaik, instruksi teknis styling rinci, saran warna rambut paling cocok, dan estimasi panjang rambut. PENTING: Dalam 'instruksi_detail', sertakan juga DESKRIPSI SANGAT DETAIL tentang wajah asli user (gender, bentuk wajah, warna kulit, fitur mata/hidung, pakaian, dan latar belakang) agar AI Image Generator dapat meniru wajah user semirip mungkin!`,
    `- SELARASAN DENGAN IMAGE GEN: 'try_on_config.gaya_target' harus sama persis dengan 'rekomendasi_gaya[0].nama_gaya' (rekomendasi teratas) agar model gambar tidak menerjemahkan nama gaya yang berbeda. Instruksi_detail harus menyebut elemen potongan yang terlihat di foto (fade/taper, panjang atas, fringe/textured top, dll.) yang relevan dengan nama gaya tersebut.`,
  ],
  promptSections: [
    `- Isi 'try_on_config' dengan konfigurasi virtual try-on terbaik untuk wajah ini.`,
  ]
};
