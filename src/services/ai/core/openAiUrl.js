/**
 * Normalisasi base URL MAIA / OpenAI-compatible untuk mendapatkan root .../v1.
 * Menghapus segala sesuatu setelah /v1 jika ada.
 * @param {string} baseUrl
 * @returns {string}
 */
function normalizeOpenAiBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== "string") return "";
  let u = baseUrl.trim().replace(/\/$/, "");

  const v1Index = u.toLowerCase().indexOf("/v1");
  if (v1Index !== -1) {
    return u.substring(0, v1Index + 3);
  }

  if (u.endsWith("/chat/completions")) u = u.slice(0, -"/chat/completions".length);
  return u.replace(/\/$/, "");
}

/**
 * URL absolut untuk POST chat completions (axios).
 * @param {string} baseUrl
 * @returns {string}
 */
function resolveChatCompletionsPostUrl(baseUrl) {
  const root = normalizeOpenAiBaseUrl(baseUrl);
  if (!root) return baseUrl;
  return `${root}/chat/completions`;
}

/**
 * URL untuk fetch balance/credits (axios).
 * @param {string} baseUrl
 * @returns {string}
 */
function resolveBalanceUrl(baseUrl) {
  const root = normalizeOpenAiBaseUrl(baseUrl);
  if (!root) return baseUrl;

  return `${root}/credits`;
}

module.exports = { normalizeOpenAiBaseUrl, resolveChatCompletionsPostUrl, resolveBalanceUrl };
