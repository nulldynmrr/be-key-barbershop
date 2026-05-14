/**
 * Jendela "hasil masih segar" untuk kombinasi user + hash foto + fingerprint fitur (cache DB/RAM).
 * Lewat jendela → LLM dipanggil lagi; baris history lama tidak dihapus (hanya tambah entri baru).
 *
 * --- Kasus produk yang dilindungi ---
 * - Double klik / retry jaringan: dedupe singkat mencegah dua kali hit LLM untuk input sama.
 * - Restart server: cache DB mengembalikan hasil identik (SUBSCRIPTION / jeda panjang) tanpa halusinasi baru.
 * - Top-up koin (ONTIME): pengguna membawa **aversi rugi** — bayar koin lalu dapat jawaban yang sama berminggu-minggu
 *   terasa seperti "koin hangus". Jeda **pendek** membuat unggah ulang setelah beberapa hari terasa **konsultasi baru**.
 * - Free trial: kredit sedikit; pengalaman harus terasa **responsif** dan **bukan dikunci** ke satu jawaban lama terlalu lama.
 * - Langganan: ekspektasi "saya bayar periode" — selaras dengan **durationDays** (siklus tagihan / bulanan).
 *
 * --- Psikologi ringkas (acuan desain) ---
 * - **Kendali & keadilan** (ONTIME): setiap pemakaian koin harus terasa **disengaja**; dedupe panjang menurunkan perasaan kendali.
 * - **Ritme langganan** (SUBSCRIPTION): konsistensi hasil untuk foto sama dalam satu periode = **wajar & menenangkan**.
 * - **Curiosity / novelty** (trial & top-up): rekomendasi gaya yang "diperbarui" sesekali cocok dengan keinginan variasi tanpa menghapus riwayat.
 *
 * Env (opsional):
 * - `FREE_TRIAL_ANALYSIS_CACHE_DAYS` — default **3** (0 = hampir selalu refresh dari sisi umur DB).
 * - `ONTIME_ANALYSIS_CACHE_DAYS` — default **5** (~satu minggu kerja; keseimbangan spam vs rasa segar).
 * - `ANALYSIS_CACHE_DAYS_DEFAULT` — fallback SUBSCRIPTION bila `durationDays` tidak valid (default **30**).
 */
const DEFAULT_SUBSCRIPTION_FALLBACK_DAYS = Number(process.env.ANALYSIS_CACHE_DAYS_DEFAULT) || 30;
const MAX_DAYS = 366;

function clampDays(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_DAYS, Math.max(0, Math.floor(n)));
}

const TRIAL_CACHE_DAYS = clampDays(process.env.FREE_TRIAL_ANALYSIS_CACHE_DAYS, 3);
const ONTIME_CACHE_DAYS = clampDays(process.env.ONTIME_ANALYSIS_CACHE_DAYS, 5);

/**
 * @param {object|null|undefined} userPackage — dari DB atau objek free trial billingNode
 * @param {boolean} isFreeTrial
 * @returns {number}
 */
function getAnalysisRefreshWindowDays(userPackage, isFreeTrial) {
  if (isFreeTrial) return TRIAL_CACHE_DAYS;
  if (!userPackage || typeof userPackage !== "object") return ONTIME_CACHE_DAYS;

  const type = String(userPackage.typeValue || "").toUpperCase();
  if (type === "SUBSCRIPTION") {
    const d = Number(userPackage.durationDays);
    if (Number.isFinite(d) && d > 0) return Math.min(Math.floor(d), MAX_DAYS);
    return DEFAULT_SUBSCRIPTION_FALLBACK_DAYS;
  }

  if (type === "ONTIME") return ONTIME_CACHE_DAYS;

  return ONTIME_CACHE_DAYS;
}

module.exports = {
  getAnalysisRefreshWindowDays,
  DEFAULT_SUBSCRIPTION_FALLBACK_DAYS,
  TRIAL_CACHE_DAYS,
  ONTIME_CACHE_DAYS,
  MAX_DAYS,
};
