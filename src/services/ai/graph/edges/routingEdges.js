const routeAfterLLM = (state) => {
  const needsImageGen =
    state.activeFeatures?.includes("VIRTUAL_TRY_ON") && state.configImageGen != null;

  if (process.env.DEBUG_AI_GRAPH === "1") {
    console.log(
      `[LangGraph Edge] routeAfterLLM → ${needsImageGen ? "imageGenNode" : "dbTransactionNode"}`,
    );
  }

  return needsImageGen ? "imageGenNode" : "dbTransactionNode";
};

module.exports = { routeAfterLLM };
