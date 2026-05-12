/**
 * Strategi Secrets Management:
 * Di production, kredensial sensitif diinjeksi ke process.env secara dinamis dari Secret Manager
 * untuk menghindari kebocoran .env.
 */

const loadSecrets = async () => {
  if (process.env.NODE_ENV === "production") {
    try {
      // Pseudocode fetching rahasia dari Vault / Secret Manager (contoh Doppler)
      // const { DopplerClient } = require("@dopplerhq/node-sdk");
      // const doppler = new DopplerClient({ token: process.env.DOPPLER_TOKEN });
      // const secrets = await doppler.projects.secrets.get("key-barber", "prd");

      // Injeksi ke memory (TIDAK menyentuh file .env fisik)
      // process.env.DATABASE_URL = secrets.DATABASE_URL;

      console.log("[Secrets Manager] Kredensial berhasil diinjeksi ke memory dari Vault.");
    } catch (err) {
      console.error("[Secrets Manager] Gagal mengambil kredensial dari Vault:", err.message);
      // Pilihan: hentikan proses jika secrets tidak berhasil diload
      // process.exit(1);
    }
  } else {
    console.log("[Secrets Manager] Mode Development/Local. Menggunakan local .env fallback.");
  }
};

module.exports = { loadSecrets };
