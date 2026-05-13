const crypto = require("crypto");
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

const cache = require("../../../../utils/memoryCache");
const { decrypt } = require("../../../../utils/encryption");
const { reportSystemError } = require("../../../alert.service");
const { buildDynamicPrompt } = require("../../core/promptBuilder");
const { normalizeOpenAiBaseUrl } = require("../../core/openAiUrl");
const { FaceAnalysisOutputSchema } = require("../../schemas/analysisOutput.schema");
const { calculateRealBilling } = require("../../billing");

const prisma = require("../../../../config/prisma");

const MAX_RETRIES = 3;

const DATA_URL_MIME_FALLBACK = "image/jpeg";

function extractBudgetAndMessage(aiError) {
  const msg = aiError?.message || "";
  const lc = aiError?.lc_kwargs || {};
  const response = aiError?.response || lc?.response;
  const data = response?.data || aiError?.response?.data;
  const errorBody = data?.error || {};
  const errorMsg = errorBody.message || msg;
  return { errorBody, errorMsg: String(errorMsg) };
}

const llmNode = async (state) => {
  const { userId, file, activeFeatures, configAi, billingBase, imageBase64 } = state;

  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const err = new Error("State graph tidak valid: buffer gambar hilang.");
    err.statusCode = 500;
    throw err;
  }
  if (!billingBase || typeof billingBase.totalKoinFitur !== "number") {
    const err = new Error("State graph tidak valid: billingBase hilang.");
    err.statusCode = 500;
    throw err;
  }

  const imageFingerprint = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const cacheKey = `ai_result:${imageFingerprint}`;
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    if (process.env.DEBUG_AI_GRAPH === "1") {
      console.log(`[LangGraph llmNode] Cache HIT. Bypass LLM. Hash: ${imageFingerprint}`);
    }
    const realBilling = calculateRealBilling(
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      configAi,
      billingBase,
      billingBase.totalKoinFitur,
    );
    return {
      hasil_analisis: cachedResult,
      llmUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      realBilling,
      totalDipotong: realBilling.totalDipotong,
    };
  }

  const { systemInstruction, promptText } = buildDynamicPrompt(activeFeatures);
  const decryptedApiKey = decrypt(configAi.apiKey);
  const baseURL = normalizeOpenAiBaseUrl(configAi.baseUrl);

  const llm = new ChatOpenAI({
    apiKey: decryptedApiKey,
    model: configAi.modelName,
    temperature: 0,
    timeout: 120000,
    maxRetries: MAX_RETRIES,
    configuration: { baseURL },
  });

  const structuredLlm = llm.withStructuredOutput(FaceAnalysisOutputSchema, {
    name: "face_analysis_output",
    method: "jsonMode",
    includeRaw: true,
  });

  const b64 = imageBase64 ?? file.buffer.toString("base64");
  const mimeForDataUrl =
    file.mimetype && /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)
      ? file.mimetype
      : DATA_URL_MIME_FALLBACK;
  const imageDataUrl = `data:${mimeForDataUrl};base64,${b64}`;

  const messages = [
    new SystemMessage(systemInstruction),
    new HumanMessage({
      content: [
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    }),
  ];

  let hasil_analisis;
  let llmUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  try {
    const rawResult = await structuredLlm.invoke(messages);
    hasil_analisis = rawResult.parsed;
    const rawMsg = rawResult.raw;
    if (rawMsg?.usage_metadata) {
      llmUsage = {
        prompt_tokens: rawMsg.usage_metadata.input_tokens ?? rawMsg.usage_metadata.prompt_tokens ?? 0,
        completion_tokens: rawMsg.usage_metadata.output_tokens ?? rawMsg.usage_metadata.completion_tokens ?? 0,
        total_tokens: rawMsg.usage_metadata.total_tokens ?? 0,
      };
    }
  } catch (aiError) {
    const { errorBody, errorMsg } = extractBudgetAndMessage(aiError);

    if (errorBody.type === "budget_exceeded" || errorMsg.includes("Budget has been exceeded")) {
      const budgetMatch = errorMsg.match(/Max budget:\s*([\d.]+)/i);
      const realMaxBudget = budgetMatch ? parseFloat(budgetMatch[1]) : null;
      const updateData = { isActive: false };
      if (realMaxBudget !== null) updateData.maxBudget = realMaxBudget;

      prisma.aiModel
        .update({ where: { id: configAi.id }, data: updateData })
        .then(() => console.log(`[Budget Sync] Model ${configAi.modelName} dinonaktifkan`))
        .catch((e) => console.error("[Budget Sync] Gagal:", e.message));

      reportSystemError(
        "LLM_BUDGET_EXCEEDED",
        `💸 Budget API LLM HABIS! Model: ${configAi.modelName}. Budget: $${realMaxBudget || "?"}`,
        "CRITICAL",
      ).catch(() => { });

      const err = new Error("Layanan AI sedang dalam pemeliharaan. Tim kami sedang menanganinya.");
      err.statusCode = 503;
      err.errorCode = "SERVICE_UNAVAILABLE";
      throw err;
    }

    let userEmail = userId;
    try {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (u?.email) userEmail = u.email;
    } catch (_) {
      /* ignore */
    }

    reportSystemError(
      "AI_SERVICE",
      `AI call gagal setelah ${MAX_RETRIES}x retry. Model: ${configAi.modelName}. Error: ${aiError.message}. User: ${userEmail}`,
      "CRITICAL",
    ).catch(() => { });

    const err = new Error(`AI gagal merespons setelah ${MAX_RETRIES} percobaan. Silakan coba lagi nanti.`);
    err.statusCode = 503;
    throw err;
  }

  cache.set(cacheKey, hasil_analisis, 86400);

  const realBilling = calculateRealBilling(llmUsage, configAi, billingBase, billingBase.totalKoinFitur);

  return {
    hasil_analisis,
    llmUsage,
    realBilling,
    totalDipotong: realBilling.totalDipotong,
  };
};

module.exports = { llmNode };
