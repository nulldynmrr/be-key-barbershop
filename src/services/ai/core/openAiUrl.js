/**
 * Normalisasi base URL MAIA / OpenAI-compatible untuk klien yang mengharapkan root .../v1.
 * @param {string} baseUrl
 * @returns {string|undefined}
 */
function normalizeOpenAiBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== "string") return baseUrl;
  let u = baseUrl.replace(/\/$/, "");
  if (u.endsWith("/chat/completions")) u = u.slice(0, -"/chat/completions".length);
  if (u.endsWith("/v1/chat/completions")) u = u.replace(/\/v1\/chat\/completions$/i, "/v1");
  return u;
}

/**
 * URL absolut untuk POST chat completions (axios), bukan baseURL klien OpenAI.
 * Menerima root …/v1, …/v1/, atau URL yang sudah berakhiran …/chat/completions.
 * @param {string} baseUrl
 * @returns {string|undefined}
 */
function resolveChatCompletionsPostUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== "string") return baseUrl;
  let u = baseUrl.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(u)) return u;
  if (/\/v1$/i.test(u)) return `${u}/chat/completions`;
  return `${u}/v1/chat/completions`;
}

module.exports = { normalizeOpenAiBaseUrl, resolveChatCompletionsPostUrl };
