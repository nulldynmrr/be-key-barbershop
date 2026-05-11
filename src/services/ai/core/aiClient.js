const axios = require("axios");
const { decrypt } = require("../../../utils/encryption");
const { reportSystemError } = require("../../alert.service");

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

/**
 * Eksekusi pemanggilan ke LLM dengan retry logic.
 */
const callAiLLM = async (configAi, systemInstruction, promptText, imageBase64, mimetype, userId) => {
  const decryptedApiKey = decrypt(configAi.apiKey);
  let maiaResponse;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      maiaResponse = await axios.post(
        `${configAi.baseUrl}/chat/completions`,
        {
          model: configAi.modelName,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: `data:${mimetype};base64,${imageBase64}` } },
              ],
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${decryptedApiKey}` },
          timeout: 120000,
        }
      );
      return maiaResponse.data;
    } catch (aiError) {
      if (attempt === MAX_RETRIES) {
        reportSystemError(
          "AI_SERVICE",
          `AI call gagal setelah ${MAX_RETRIES}x retry. Model: ${configAi.modelName}. Error: ${aiError.message}. User: ${userId}`,
          "CRITICAL"
        ).catch(() => {});

        const err = new Error(`AI gagal merespons setelah ${MAX_RETRIES} percobaan. Silakan coba lagi nanti.`);
        err.statusCode = 503;
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1] || 5000));
    }
  }
};

module.exports = { callAiLLM };
