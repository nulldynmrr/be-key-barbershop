const { z } = require("zod");

const basePackageSchema = z.object({
  namaPaket: z.string().min(3, "Nama paket minimal 3 karakter"),
  deskripsi: z.string().optional(),
  typeValue: z.enum(["ONTIME", "SUBSCRIPTION"]),
  jumlahKoin: z.number().int().nonnegative().default(0),

  featStandardScan: z.boolean().default(true),
  featSymmetry: z.boolean().default(false),
  featAdvMapping: z.boolean().default(false),
  featVirtualTryOn: z.boolean().default(false),
  featHistory: z.boolean().default(false),

  hppIdeal: z
    .number()
    .positive("Sistem butuh HPP Ideal untuk validasi boncos!"),
  hargaNominal: z.number().positive(),

  durasi_value: z.number().int().positive().optional().nullable(),
  durasi_unit: z.enum(["HARI", "BULAN", "TAHUN"]).optional().nullable(),

  promoAktif: z.boolean().default(false),
  hargaDiskon: z.number().positive().optional().nullable(),
  diskonMulai: z.string().datetime().optional().nullable(),
  diskonAkhir: z.string().datetime().optional().nullable(),
});

const packageSchema = basePackageSchema
  .refine((data) => data.hargaNominal >= data.hppIdeal, {
    message: "FATAL: Harga Nominal di bawah HPP Ideal! Perusahaan bisa rugi.",
    path: ["hargaNominal"],
  })
  .refine(
    (data) => {
      if (data.promoAktif && data.hargaDiskon) {
        return data.hargaDiskon >= data.hppIdeal;
      }
      return true;
    },
    {
      message:
        "FATAL: Harga Diskon tidak boleh lebih rendah dari modal (HPP Ideal)!",
      path: ["hargaDiskon"],
    },
  );

const updatePackageSchema = basePackageSchema
  .partial()
  .refine(
    (data) => {
      if (data.hppIdeal !== undefined && data.hargaNominal !== undefined) {
        return data.hargaNominal >= data.hppIdeal;
      }
      return true;
    },
    {
      message:
        "FATAL: Harga Nominal update tidak boleh lebih kecil dari HPP Ideal!",
      path: ["hargaNominal"],
    },
  )
  .refine(
    (data) => {
      if (
        data.promoAktif &&
        data.hargaDiskon !== undefined &&
        data.hppIdeal !== undefined
      ) {
        return data.hargaDiskon >= data.hppIdeal;
      }
      return true;
    },
    {
      message:
        "FATAL: Harga Diskon Promo tidak boleh menginjak batas HPP Ideal!",
      path: ["hargaDiskon"],
    },
  );

module.exports = { packageSchema, updatePackageSchema };
