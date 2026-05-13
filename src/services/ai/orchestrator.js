const { StateGraph, START, END } = require("@langchain/langgraph");
const { FaceAnalysisStateAnnotation } = require("./graph/state");
const { billingNode } = require("./graph/nodes/billingNode");
const { llmNode } = require("./graph/nodes/llmNode");
const { imageGenNode } = require("./graph/nodes/imageGenNode");
const { dbTransactionNode } = require("./graph/nodes/dbTransactionNode");
const { routeAfterLLM } = require("./graph/edges/routingEdges");

const workflow = new StateGraph(FaceAnalysisStateAnnotation)
  .addNode("billingNode", billingNode)
  .addNode("llmNode", llmNode)
  .addNode("imageGenNode", imageGenNode)
  .addNode("dbTransactionNode", dbTransactionNode)
  .addEdge(START, "billingNode")
  .addEdge("billingNode", "llmNode")
  .addConditionalEdges("llmNode", routeAfterLLM, {
    imageGenNode: "imageGenNode",
    dbTransactionNode: "dbTransactionNode",
  })
  .addEdge("imageGenNode", "dbTransactionNode")
  .addEdge("dbTransactionNode", END);

const compiledGraph = workflow.compile();

/**
 * @param {string} userId
 * @param {object} file 
 * @param {string[]} requestedFeatures
 * @returns {object}
 */
const processFaceAnalysis = async (userId, file, requestedFeatures) => {
  const initialState = {
    userId,
    file,
    requestedFeatures,
  };

  const finalState = await compiledGraph.invoke(initialState);

  return {
    kualitas_ok: finalState.hasil_analisis?.kualitas_foto_ok,
    alasan: finalState.hasil_analisis?.alasan_kualitas || null,
    totalDipotong: finalState.totalDipotong,
    totalKoinFitur: finalState.billingBase?.totalKoinFitur,
    realKoinAi: finalState.realBilling?.realKoinAi,
    imageGenKoin: finalState.imageGenKoin ?? 0,
    activeFeatures: finalState.activeFeatures,
    hasil_analisis: finalState.hasil_analisis,
    resultTx: finalState.resultTx,
    total_tokens: finalState.llmUsage?.total_tokens || 0,
    realCostUsd: finalState.realBilling?.realCostUsd,
    url_foto_upload: finalState.url_foto_upload,
    url_hasil_img: finalState.activeFeatures?.includes("VIRTUAL_TRY_ON")
      ? finalState.generatedImageUrls
      : null,
    sisa_credit_before: finalState.sisa_credit_before,
    sisa_credit_after: finalState.sisa_credit_after,
  };
};

module.exports = { processFaceAnalysis };
