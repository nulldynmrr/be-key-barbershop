const axios = require("axios");
const { decrypt } = require("../../../utils/encryption");
const { reportSystemError } = require("../../alert.service");
const prisma = require("../../../config/prisma");

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
        `${configAi.baseUrl}`,
        {
          model: configAi.modelName,
          temperature: 0,
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
      const errorBody = aiError.response?.data?.error || {};
      const errorMsg = errorBody.message || aiError.message;

      // Deteksi budget habis -> sinkronisasi budget + matikan model + kirim alert CRITICAL
      if (errorBody.type === "budget_exceeded" || errorMsg.includes("Budget has been exceeded")) {
        const budgetMatch = errorMsg.match(/Max budget:\s*([\d.]+)/i);
        const realMaxBudget = budgetMatch ? parseFloat(budgetMatch[1]) : null;

        // Samakan maxBudget dan nonaktifkan model
        const updateData = { isActive: false };
        if (realMaxBudget !== null) updateData.maxBudget = realMaxBudget;

        prisma.aiModel.update({
          where: { id: configAi.id },
          data: updateData,
        }).then(() => {
          console.log(`[Budget Sync LLM] Model ${configAi.modelName} dinonaktifkan & budget disinkron ke $${realMaxBudget}`);
        }).catch((dbErr) => console.error("[Budget Sync LLM] Gagal update DB:", dbErr.message));

        reportSystemError(
          "LLM_BUDGET_EXCEEDED",
          `💸 Budget API LLM HABIS & Model Dinonaktifkan!\nModel: ${configAi.modelName}\nBudget provider: $${realMaxBudget || '?'}\n\n👉 Top-up sekarang: https://dash.maiarouter.ai/dashboard\n\nSetelah top-up, aktifkan kembali model di Dashboard > AI Config.`,
          "CRITICAL"
        ).catch(() => { });

        const err = new Error(`Layanan AI sedang dalam pemeliharaan. Tim kami sedang menanganinya.`);
        err.statusCode = 503;
        err.errorCode = "SERVICE_UNAVAILABLE";
        throw err;
      }

      if (attempt === MAX_RETRIES) {
        reportSystemError(
          "AI_SERVICE",
          `AI call gagal setelah ${MAX_RETRIES}x retry. Model: ${configAi.modelName}. Error: ${aiError.message}. User: ${userId}`,
          "CRITICAL"
        ).catch(() => { });

        const err = new Error(`AI gagal merespons setelah ${MAX_RETRIES} percobaan. Silakan coba lagi nanti.`);
        err.statusCode = 503;
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1] || 5000));
    }
  }
};

module.exports = { callAiLLM };
