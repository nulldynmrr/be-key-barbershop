const { extractImageFromChatMessage } = require("../src/services/ai/core/imageGenClient");

const mockResponses = [
  {
    name: "Gemini Native Format (content array)",
    msg: {
      role: "assistant",
      content: [
        { type: "text", text: "Here is your haircut." },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" } }
      ]
    }
  },
  {
    name: "MAIA Image Format (images array)",
    msg: {
      role: "assistant",
      content: "Result image",
      images: [
        { image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA" } }
      ]
    }
  },
  {
    name: "Legacy B64 Content",
    msg: {
      role: "assistant",
      content: "data:image/webp;base64,UklGRqYAAABXRUJQVlA4IDoAAAD"
    }
  }
];

mockResponses.forEach(r => {
  const result = extractImageFromChatMessage(r.msg);
  console.log(`Test: ${r.name}`);
  console.log(`Result Type: ${result?.type || 'NULL'}`);
  if (result?.type === 'base64') console.log(`Value start: ${result.value.substring(0, 20)}...`);
  console.log('---');
});
