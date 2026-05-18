const sharp = require("sharp");

/**
 * Sesuaikan orientasi gambar hasil model agar proporsi mirip foto input
 * (menangani kasus output landscape padahal input portrait → sering terlihat "miring 90°").
 * Lalu terapkan auto-orient EXIF bila ada.
 *
 * @param {Buffer} inputBuffer — buffer foto user (sudah dinormalisasi di billing)
 * @param {Buffer} generatedBuffer — buffer dari API image gen
 * @returns {Promise<Buffer>}
 */
async function alignTryOnImageToInput(inputBuffer, generatedBuffer) {
  let buf = generatedBuffer;
  try {
    buf = await sharp(buf).rotate().toBuffer();
  } catch {
    return generatedBuffer;
  }

  try {
    const [metaIn, metaOut] = await Promise.all([
      sharp(inputBuffer).metadata(),
      sharp(buf).metadata(),
    ]);
    const iw = metaIn.width || 1;
    const ih = metaIn.height || 1;
    const ow = metaOut.width || 1;
    const oh = metaOut.height || 1;
    const inRatio = iw / ih;
    const asIs = ow / oh;
    const ifRot90 = oh / ow;
    const errAsIs = Math.abs(asIs - inRatio);
    const errRot90 = Math.abs(ifRot90 - inRatio);
    if (errRot90 + 0.06 < errAsIs) {
      buf = await sharp(buf).rotate(90).toBuffer();
    }
  } catch {
    /* pakai buf hasil rotate() saja */
  }

  return buf;
}

/**
 * Pilih aspectRatio API yang mendekati foto input (kurangi crop paksa 1:1).
 * Hanya nilai yang umum didukung router (hindari 400 dari enum aspek tidak dikenal).
 * @param {Buffer} inputBuffer
 * @returns {Promise<"1:1"|"3:4"|"4:3">}
 */
async function pickImageAspectRatioForInput(inputBuffer) {
  try {
    const m = await sharp(inputBuffer).metadata();
    const w = m.width || 1;
    const h = m.height || 1;
    const r = w / h;
    if (r < 0.92) return "3:4";
    if (r > 1.12) return "4:3";
    return "1:1";
  } catch {
    return "3:4";
  }
}

module.exports = { alignTryOnImageToInput, pickImageAspectRatioForInput };
