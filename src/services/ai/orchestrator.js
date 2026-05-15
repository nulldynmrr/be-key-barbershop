const { StateGraph, START, END } = require("@langchain/langgraph");
const { FaceAnalysisStateAnnotation } = require("./graph/state");
const { billingNode } = require("./graph/nodes/billingNode");
const { llmNode } = require("./graph/nodes/llmNode");
const { imageGenNode } = require("./graph/nodes/imageGenNode");
const { dbTransactionNode } = require("./graph/nodes/dbTransactionNode");
const { routeAfterLLM } = require("./graph/edges/routingEdges");
const { inferJenisRambut } = require("./graph/nodes/llm/llmResponseParser");

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
const processFaceAnalysis = async (userId, file, requestedFeatures, source = "file", onStatusUpdate) => {
  const initialState = {
    userId,
    file,
    requestedFeatures,
    source,
  };

  let finalState;
  try {
    // Gunakan .stream() untuk mendapatkan progress tiap node secara real-time
    const eventStream = await compiledGraph.stream(initialState);
    let currentState = initialState;

    for await (const chunk of eventStream) {
      const nodeName = Object.keys(chunk)[0];
      if (onStatusUpdate && nodeName) {
        onStatusUpdate(nodeName);
      }
      // Merge the node's output into our tracked state
      currentState = { ...currentState, ...chunk[nodeName] };
      finalState = currentState;
    }
  } catch (err) {
    // If the graph fails, we don't have finalState yet. 
    // Any cleanup would need to happen inside nodes or we'd need to catch the url elsewhere.
    // For now, let's ensure the most critical part (orphaned files) is handled.
    throw err;
  } finally {
    // Cleanup orphaned file if DB transaction failed
    if (finalState && !finalState.resultTx && finalState.url_foto_upload) {
      const fs = require("fs");
      const path = require("path");
      const filePath = path.join(process.cwd(), finalState.url_foto_upload);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Orchestrator] Cleaned up orphaned file: ${finalState.url_foto_upload}`);
      }
    }
  }

  const hasil = finalState.hasil_analisis;
  const hasilNormalized =
    hasil && typeof hasil === "object" ? { ...hasil, jenis_rambut: inferJenisRambut(hasil) } : hasil;

  return {
    kualitas_ok: hasilNormalized?.kualitas_foto_ok,
    alasan: hasilNormalized?.alasan_kualitas || null,
    totalDipotong: finalState.totalDipotong,
    totalKoinFitur: finalState.billingBase?.totalKoinFitur,
    realKoinAi: finalState.realBilling?.realKoinAi,
    imageGenKoin: finalState.imageGenKoin ?? 0,
    activeFeatures: finalState.activeFeatures,
    hasil_analisis: hasilNormalized,
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
