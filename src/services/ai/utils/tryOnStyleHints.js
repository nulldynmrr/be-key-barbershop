/**
 * Petunjuk siluet untuk image-gen (bukan data user — hanya memperjelas istilah barber ke model gambar).
 * Dicocokkan substring case-insensitive pada nama gaya.
 */
const STYLE_HINT_ROWS = [
  {
    keys: ["french crop", "french crop fade", "textured crop", "crop fade"],
    hint:
      "Siluet wajib: rambut atas pendek bertekstur atau lurus dengan fringe/poni pendek lurus di dahi (french crop); sisi & belakang fade/taper sangat pendek; beda jelas dari undercut slick-back atau pompadour panjang.",
  },
  {
    keys: ["undercut", "disconnected", "pompadour", "quiff", "slick back"],
    hint:
      "Siluet wajib: volume/panjang atas jelas berbeda dari sisi yang sangat tipis atau dicukur; beda jelas dari french crop yang pendek di atas.",
  },
  {
    keys: ["buzz", "buzz cut", "skin fade", "high fade", "low fade", "taper fade", "fade"],
    hint:
      "Siluet wajib: gradasi fade halus di sisi; transisi panjang rambut atas vs sisi terlihat jelas seperti referensi pangkas fade profesional.",
  },
  {
    keys: ["mullet", "wolf", "shag", "perm", "korean perm"],
    hint:
      "Siluet wajib: panjang belakang atau tekstur ikal/bergelombang sesuai nama gaya; tidak boleh identik dengan potongan crop pendek.",
  },
];

/**
 * @param {string} styleName
 * @returns {string|null} — paragraf bahasa Inggris untuk prompt image model
 */
function getStyleSilhouetteHint(styleName) {
  const n = String(styleName || "").toLowerCase().trim();
  if (!n) return null;
  for (const row of STYLE_HINT_ROWS) {
    if (row.keys.some((k) => n.includes(k))) return row.hint;
  }
  return null;
}

module.exports = { getStyleSilhouetteHint, STYLE_HINT_ROWS };
