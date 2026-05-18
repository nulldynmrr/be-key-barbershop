const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { decrypt } = require("../../../../../utils/encryption");
const { normalizeOpenAiBaseUrl } = require("../../../core/openAiUrl");
const { FaceAnalysisOutputSchema } = require("../../../schemas/analysisOutput.schema");
const { reportSystemError } = require("../../../../alert.service");
const prisma = require("../../../../../config/prisma");
const {
  normalizeMessageContentToString,
  parseFaceAnalysisFromLlmText,
} = require("./llmResponseParser");

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
  const isMock = decryptedApiKey === 'sk-dummy-key';

  if (isMock) {
    console.log(`[MOCK AI] Returning dummy analysis for testing...`);
    return {
      hasil_analisis: {
        kualitas_foto_ok: true,
        gender: "Pria",
        bentuk_wajah: "Oval",
        deskripsi_bentuk_wajah: "Wajah oval yang seimbang dan simetris.",
        skor_simetri: 95,
        level_simetri: "Excellent",
        ai_confidence: 99,
        jenis_rambut: "Lurus",
        ketebalan_rambut: "Tebal",
        heatmap_wajah: { dahi: "High Suitability", pipi: "Mid Suitability", rahang: "Low Suitability", dagu: "High Suitability", zona_terbaik: "Dahi" },
        peta_proporsi: { dahi: 32, pipi_kiri: 15, pipi_kanan: 15, rahang: 20, dagu: 18 },
        pengukuran_fitur: { panjang_wajah: 85, kekuatan_rahang: 75, lebar_tulang_pipi: 90, lebar_dahi: 80, lebar_wajah: 100 },
        keseimbangan_wajah: { mata_kiri_kanan: "Symmetric", alis_kiri_kanan: "Aligned", pemusatan_hidung: "Centered", kelurusan_mulut: "Straight" },
        rekomendasi_gaya: [
          { nama_gaya: "Classic Pompadour", match_score: 98, alasan: "Cocok dengan bentuk wajah oval Anda.", petunjuk_barber: "Potong bagian samping sangat pendek." },
          { nama_gaya: "Modern Fade", match_score: 92, alasan: "Memberikan kesan modern dan segar.", petunjuk_barber: "Gunakan gradasi yang halus." }
        ]
      },
      llmUsage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
    };
  }

  const baseURL = normalizeOpenAiBaseUrl(configAi.baseUrl);

  const llm = new ChatOpenAI({
    apiKey: decryptedApiKey,
    model: configAi.modelName,
    temperature: 0,
    timeout: 120000,
    maxRetries: MAX_RETRIES,
    configuration: { baseURL },
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

  try {
    const rawResult = await llm.invoke(messages);
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    if (rawResult.additional_kwargs?.tokenUsage) {
      const u = rawResult.additional_kwargs.tokenUsage;
      usage = {
        prompt_tokens: u.prompt_tokens || 0,
        completion_tokens: u.completion_tokens || 0,
        total_tokens: u.total_tokens || 0,
      };
    } else if (rawResult.usage_metadata) {
      const u = rawResult.usage_metadata;
      usage = {
        prompt_tokens: u.input_tokens || 0,
        completion_tokens: u.output_tokens || 0,
        total_tokens: u.total_tokens || 0,
      };
    }

    const textBlob = normalizeMessageContentToString(rawResult.content);
    const parsed = parseFaceAnalysisFromLlmText(textBlob, FaceAnalysisOutputSchema);

    if (parsed.data) {
      return { hasil_analisis: parsed.data, llmUsage: usage };
    }

    const snippet = textBlob ? textBlob.substring(0, 280) : "(empty)";
    const detail = new Error(`Format data tidak terbaca. Snippet: ${snippet}`);
    await reportError(userId, configAi, detail);

    const err = new Error("AI memberikan respons tetapi format data tidak terbaca. Silakan coba lagi.");
    err.statusCode = 422;
    err.errorCode = "AI_PARSE_ERROR";
    err.reportedToOps = true;
    throw err;
  } catch (aiError) {
    const { errorBody, errorMsg } = extractBudgetAndMessage(aiError);

    if (errorBody.type === "budget_exceeded" || errorMsg.includes("Budget has been exceeded")) {
      await handleBudgetExceeded(configAi, errorMsg);
      const err = new Error("Layanan AI sedang dalam pemeliharaan. Tim kami sedang menanganinya.");
      err.statusCode = 503;
      err.errorCode = "SERVICE_UNAVAILABLE";
      throw err;
    }

    if (aiError.errorCode === "AI_PARSE_ERROR" || aiError.statusCode === 422) {
      throw aiError;
    }

    await reportError(userId, configAi, aiError);
    const err = new Error(`AI gagal merespons setelah ${MAX_RETRIES} percobaan. Silakan coba lagi nanti.`);
    err.statusCode = 503;
    err.errorCode = "AI_SERVICE_ERROR";
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
