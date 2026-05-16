const { extractImageFromChatMessage } = require("../src/services/ai/core/imageGenClient");

// Simulasi respons NATIVE GEMINI yang sering dikirim MAIA Router
const mockGeminiResponse = {
  candidates: [
    {
      content: {
        parts: [
          { text: "Here is your transformed image:" },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" // Mock base64
            }
          }
        ]
      }
    }
  ]
};

const result = extractImageFromChatMessage(mockGeminiResponse);
console.log("Extraction Result:", JSON.stringify(result, null, 2));

if (result && result.type === "base64" && result.value.length > 0) {
  console.log("SUCCESS: Native Gemini Extraction Works!");
} else {
  console.error("FAILED: Native Gemini Extraction Failed!");
}
