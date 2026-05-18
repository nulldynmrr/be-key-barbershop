/**
 * Salin deep JSON dari kolom Prisma / driver (object | string) tanpa throw.
 * @param {unknown} value
 * @returns {object|null}
 */
function cloneJsonSafe(value) {
  if (value == null) return null;
  try {
    if (typeof value === "string") {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return JSON.parse(JSON.stringify(value));
    }
  } catch {
    /* data korup / bukan JSON */
  }
  return null;
}

module.exports = { cloneJsonSafe };
