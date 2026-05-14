const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Batas konservatif agar buffer besar tidak masuk pipeline Sharp/LLM. */
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * Validasi awal state graph (defense in depth; route juga memvalidasi).
 * @param {{ userId?: string, file?: import("multer").File, requestedFeatures?: unknown }} state
 */
function assertValidAnalyzeUpload(state) {
  const { userId, file, requestedFeatures } = state;

  if (!userId || typeof userId !== "string") {
    const err = new Error("Permintaan tidak valid: pengguna tidak dikenali.");
    err.statusCode = 400;
    throw err;
  }

  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    const err = new Error("File gambar tidak valid atau kosong.");
    err.statusCode = 400;
    throw err;
  }

  if (file.buffer.length > MAX_IMAGE_BYTES) {
    const err = new Error("Ukuran gambar melebihi batas yang diizinkan.");
    err.statusCode = 413;
    throw err;
  }

  if (!Array.isArray(requestedFeatures)) {
    const err = new Error("Parameter fitur tidak valid.");
    err.statusCode = 400;
    throw err;
  }

  const m = (file.mimetype || "").toLowerCase();
  if (m && !ALLOWED_IMAGE_MIMES.has(m)) {
    const err = new Error(`Tipe file gambar tidak didukung: ${file.mimetype}`);
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  assertValidAnalyzeUpload,
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_BYTES,
};
