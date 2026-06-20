const routeAfterLLM = (state) => {
  if (state.photo_violation_detected) {
    if (process.env.DEBUG_AI_GRAPH === "1") {
      console.log(`[LangGraph Edge] routeAfterLLM → dbTransactionNode (Photo Violation Detected)`);
    }
    return "dbTransactionNode";
  }

  // Defer image generation to the /result page per client requirements (handled on demand)
  const needsImageGen = false;

  if (process.env.DEBUG_AI_GRAPH === "1") {
    console.log(
      `[LangGraph Edge] routeAfterLLM → ${needsImageGen ? "imageGenNode" : "dbTransactionNode"}`,
    );
  }

  return needsImageGen ? "imageGenNode" : "dbTransactionNode";
};

module.exports = { routeAfterLLM };
