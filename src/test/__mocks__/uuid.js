// Jest-only shim untuk paket `uuid` (ESM-only sejak v9+, tidak bisa di-require Jest's CJS runtime).
// Hanya `v4` yang dipakai di kode produksi (src/middleware/security.middleware.js).
const crypto = require("crypto");

module.exports = {
  v4: () => crypto.randomUUID(),
};
