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
  jenis_rambut: z.string().optional().nullable(),
  ketebalan_rambut: z.string().optional().nullable(),
  ai_confidence: z.coerce.number().optional().nullable(),

  rekomendasi_gaya: z.array(RekomendasiGayaSchema),
  catatan_stylist: z.string().optional().nullable(),
  instruksi_barber: z.string().optional().nullable(),

  heatmap_wajah: z.record(z.any()).optional().nullable(),

  skor_simetri: z.coerce.number().optional().nullable(),
  level_simetri: z.string().optional().nullable(),
  detail_simetri: z.record(z.string()).optional().nullable(),

  peta_proporsi: z.record(z.any()).optional().nullable(),
  pengukuran_fitur: z.record(z.any()).optional().nullable(),
  keseimbangan_wajah: z.record(z.any()).optional().nullable(),

  ketebalan_rambut_mm: z.coerce.number().optional().nullable(),
  kepadatan_rambut: z.coerce.number().optional().nullable(),
  kesehatan_kulit_kepala: z.coerce.number().optional().nullable(),
  potensi_pertumbuhan: z.coerce.number().optional().nullable(),
  kondisi_rambut: z.string().optional().nullable(),
  rekomendasi_perawatan: z.string().optional().nullable(),

  risiko_gaya: z.any().optional().nullable(),
  instruksi_barber_detail: z.record(z.any()).optional().nullable(),
  trending_styles: z.any().optional().nullable(),
  kompatibilitas_gaya: z.coerce.number().optional().nullable(),
  try_on_config: z.any().optional().nullable(),
})
  .passthrough();

module.exports = { FaceAnalysisOutputSchema, RekomendasiGayaSchema };
