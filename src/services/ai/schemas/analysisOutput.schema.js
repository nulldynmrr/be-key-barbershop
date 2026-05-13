const { z } = require("zod");

const RekomendasiGayaSchema = z.object({
  nama_gaya: z.string().describe("Nama gaya rambut yang direkomendasikan"),
  alasan: z.string().describe("Alasan rekomendasi berdasarkan analisis wajah"),
  match_score: z.number().min(0).max(100).describe("Skor kecocokan 0-100"),
  skor_tren: z.number().min(0).max(100).optional().nullable(),
  delta_popularitas: z.string().optional().nullable(),
});

const FaceAnalysisOutputSchema = z.object({
  kualitas_foto_ok: z.boolean(),
  alasan_kualitas: z.string().nullable(),
  jumlah_wajah: z.number(),
  gender: z.string(),
  status_rambut: z.enum(["Botak", "Tertutup", "Normal"]),
  bentuk_wajah: z.string(),
  deskripsi_bentuk_wajah: z.string(),
  jenis_rambut: z.string(),
  ketebalan_rambut: z.string(),
  ai_confidence: z.number().min(0).max(100),

  rekomendasi_gaya: z.array(RekomendasiGayaSchema),
  catatan_stylist: z.string(),
  instruksi_barber: z.string().optional().nullable(),

  heatmap_wajah: z
    .object({
      dahi: z.enum(["High Suitability", "Medium", "Low"]),
      pelipis: z.enum(["High Suitability", "Medium", "Low"]),
      pipi: z.enum(["High Suitability", "Medium", "Low"]),
      rahang: z.enum(["High Suitability", "Medium", "Low"]),
      dagu: z.enum(["High Suitability", "Medium", "Low"]),
      zona_terbaik: z.string(),
      zona_fokus: z.string(),
    })
    .optional()
    .nullable(),

  skor_simetri: z.number().min(0).max(100).optional().nullable(),
  level_simetri: z.enum(["Excellent", "Good", "Average", "Poor"]).optional().nullable(),
  detail_simetri: z
    .object({
      mata: z.string(),
      alis: z.string(),
      hidung: z.string(),
      mulut: z.string(),
      dagu: z.string(),
    })
    .optional()
    .nullable(),

  peta_proporsi: z
    .object({
      dahi: z.number(),
      pipi_kiri: z.number(),
      pipi_kanan: z.number(),
      rahang: z.number(),
      dagu: z.number(),
    })
    .optional()
    .nullable(),
  pengukuran_fitur: z
    .object({
      panjang_wajah: z.number(),
      lebar_wajah: z.number(),
      kekuatan_rahang: z.number(),
      lebar_tulang_pipi: z.number(),
      lebar_dahi: z.number(),
    })
    .optional()
    .nullable(),
  keseimbangan_wajah: z
    .object({
      mata_kiri_kanan: z.string(),
      alis_kiri_kanan: z.string(),
      pemusatan_hidung: z.string(),
      kelurusan_mulut: z.string(),
      keseimbangan_dagu: z.string(),
    })
    .optional()
    .nullable(),

  ketebalan_rambut_mm: z.number().optional().nullable(),
  kepadatan_rambut: z.number().min(0).max(100).optional().nullable(),
  kesehatan_kulit_kepala: z.number().min(0).max(100).optional().nullable(),
  potensi_pertumbuhan: z.number().min(0).max(100).optional().nullable(),
  kondisi_rambut: z.string().optional().nullable(),
  rekomendasi_perawatan: z.string().optional().nullable(),

  risiko_gaya: z
    .object({
      persentase_risiko: z.number().min(0).max(100),
      level_risiko: z.enum(["Low Risk", "Medium Risk", "High Risk"]),
      deskripsi_risiko: z.string(),
      faktor_risiko: z.array(z.string()),
    })
    .optional()
    .nullable(),

  instruksi_barber_detail: z
    .object({
      teknik_potong: z.string(),
      panjang_sisi: z.string(),
      panjang_atas: z.string(),
      teknik_finishing: z.string(),
      produk_saran: z.string(),
      solusi_tambahan: z.string(),
      estimasi_waktu: z.string(),
    })
    .optional()
    .nullable(),

  trending_styles: z
    .array(
      z.object({
        nama: z.string(),
        delta: z.string(),
      }),
    )
    .optional()
    .nullable(),
  kompatibilitas_gaya: z.number().min(0).max(100).optional().nullable(),

  try_on_config: z
    .object({
      gaya_target: z.string(),
      instruksi_detail: z.string(),
      warna_rambut_saran: z.string(),
      estimasi_panjang: z.string(),
    })
    .optional()
    .nullable(),
})
  .passthrough();

module.exports = { FaceAnalysisOutputSchema, RekomendasiGayaSchema };
