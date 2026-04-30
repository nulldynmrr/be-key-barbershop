// src/services/package.service.js
import prisma from "../prisma/client.js"; // Sesuaikan path

const convertToDays = (value, unit) => {
  if (!value || !unit) return null;
  switch (unit.toUpperCase()) {
    case "BULAN":
      return value * 30;
    case "TAHUN":
      return value * 365;
    default:
      return value;
  }
};

export const getAllPackages = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  // Eksekusi count dan query secara paralel (High Performance)
  const [total, packages] = await Promise.all([
    prisma.creditPackage.count({ where: { is_active: true } }),
    prisma.creditPackage.findMany({
      where: { is_active: true },
      orderBy: { harga_normal: "asc" },
      skip,
      take: limit,
    }),
  ]);

  const now = new Date();

  // Mapping hasil query dengan memori yang efisien
  const formattedPackages = packages.map((pkg) => {
    const isPromoValid =
      pkg.harga_diskon &&
      pkg.diskon_mulai &&
      pkg.diskon_akhir &&
      now >= new Date(pkg.diskon_mulai) &&
      now <= new Date(pkg.diskon_akhir);

    let durasi_display = "Selamanya";
    if (pkg.durasi_hari) {
      if (pkg.durasi_hari % 365 === 0)
        durasi_display = `${pkg.durasi_hari / 365} Tahun`;
      else if (pkg.durasi_hari % 30 === 0)
        durasi_display = `${pkg.durasi_hari / 30} Bulan`;
      else durasi_display = `${pkg.durasi_hari} Hari`;
    }

    return {
      id: pkg.id,
      nama: pkg.nama_paket,
      tipe: pkg.tipe_paket,
      koin: pkg.jumlah_koin,
      durasi_text: durasi_display,
      harga_asli: pkg.harga_normal,
      harga_bayar: isPromoValid ? pkg.harga_diskon : pkg.harga_normal,
      is_promo: !!isPromoValid,
      berakhir_pada: isPromoValid ? pkg.diskon_akhir : null,
    };
  });

  return {
    total,
    topup_koin: formattedPackages.filter((p) => p.tipe === "ONETIME"),
    langganan_premium: formattedPackages.filter(
      (p) => p.tipe === "SUBSCRIPTION",
    ),
  };
};

export const createNewPackage = async (validatedData) => {
  const durasi_hari =
    validatedData.tipe_paket === "SUBSCRIPTION"
      ? convertToDays(validatedData.durasi_value, validatedData.durasi_unit)
      : null;

  return await prisma.creditPackage.create({
    data: {
      nama_paket: validatedData.nama_paket,
      tipe_paket: validatedData.tipe_paket,
      jumlah_koin: validatedData.jumlah_koin,
      harga_normal: validatedData.harga_normal,
      durasi_hari,
      harga_diskon: validatedData.is_promo_active
        ? validatedData.harga_diskon
        : null,
      diskon_mulai:
        validatedData.is_promo_active && validatedData.diskon_mulai
          ? new Date(validatedData.diskon_mulai)
          : null,
      diskon_akhir:
        validatedData.is_promo_active && validatedData.diskon_akhir
          ? new Date(validatedData.diskon_akhir)
          : null,
    },
  });
};
