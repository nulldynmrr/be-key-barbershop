const { z } = require("zod");

exports.userRegisterSchema = z.object({
  nama: z
    .string({ required_error: "Nama wajib diisi" })
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z
    .string({ required_error: "Email wajib diisi" })
    .email("Format email tidak valid"),
  password: z
    .string({ required_error: "Password wajib diisi" })
    .min(6, "Password minimal 6 karakter"),
  agreed: z
    .boolean({ required_error: "Persetujuan Syarat & Ketentuan wajib" })
    .refine((val) => val === true, "Anda harus menyetujui Syarat & Ketentuan"),
});
