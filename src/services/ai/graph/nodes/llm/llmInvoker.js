const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { decrypt } = require("../../../../../utils/encryption");
const { normalizeOpenAiBaseUrl } = require("../../../core/openAiUrl");
const { FaceAnalysisOutputSchema } = require("../../../schemas/analysisOutput.schema");
const { reportSystemError } = require("../../../../alert.service");
const prisma = require("../../../../../config/prisma");

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

exports.invokeLLM = async ({ configAi, systemInstruction, promptText, imageBase64, file, userId }) => {
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
  const mimeForDataUrl = file.mimetype && /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)
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

  try {
    const rawResult = await structuredLlm.invoke(messages);
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    if (rawResult.raw?.usage_metadata) {
      const u = rawResult.raw.usage_metadata;
      usage = {
        prompt_tokens: u.input_tokens ?? u.prompt_tokens ?? 0,
        completion_tokens: u.output_tokens ?? u.completion_tokens ?? 0,
        total_tokens: u.total_tokens ?? 0,
      };
    }

    return { hasil_analisis: rawResult.parsed, llmUsage: usage };
  } catch (aiError) {
    const { errorBody, errorMsg } = extractBudgetAndMessage(aiError);

    if (errorBody.type === "budget_exceeded" || errorMsg.includes("Budget has been exceeded")) {
      await handleBudgetExceeded(configAi, errorMsg);
      const err = new Error("Layanan AI sedang dalam pemeliharaan. Tim kami sedang menanganinya.");
      err.statusCode = 503;
      err.errorCode = "SERVICE_UNAVAILABLE";
      throw err;
    }

    await reportError(userId, configAi, aiError);
    const err = new Error(`AI gagal merespons setelah ${MAX_RETRIES} percobaan. Silakan coba lagi nanti.`);
    err.statusCode = 503;
    throw err;
  }
};

async function handleBudgetExceeded(configAi, errorMsg) {
  const budgetMatch = errorMsg.match(/Max budget:\s*([\d.]+)/i);
  const realMaxBudget = budgetMatch ? parseFloat(budgetMatch[1]) : null;
  const updateData = { isActive: false };
  if (realMaxBudget !== null) updateData.maxBudget = realMaxBudget;

  try {
    await prisma.aiModel.update({ where: { id: configAi.id }, data: updateData });
    console.log(`[Budget Sync] Model ${configAi.modelName} disabled`);
  } catch (e) {
    console.error("[Budget Sync] Update failed:", e.message);
  }

  await reportSystemError(
    "LLM_BUDGET_EXCEEDED",
    `💸 Budget API LLM HABIS! Model: ${configAi.modelName}. Budget: $${realMaxBudget || "?"}`,
    "CRITICAL",
  );
}

async function reportError(userId, configAi, aiError) {
  let userEmail = userId;
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (u?.email) userEmail = u.email;
  } catch (_) {}

  await reportSystemError(
    "AI_SERVICE",
    `AI call gagal. Model: ${configAi.modelName}. Error: ${aiError.message}. User: ${userEmail}`,
    "CRITICAL",
  );
}
