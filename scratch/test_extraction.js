const fs = require('fs');
const { extractImageFromChatMessage } = require('../src/services/ai/core/imageGenClient');

const s = fs.readFileSync('test_image_gen_out.txt', 'utf16le');
const match = s.match(/Full Data \(truncated\): (.*)/);
if (match) {
  try {
    const data = JSON.parse(match[1]);
    const msgObject = data?.choices?.[0]?.message || data?.candidates?.[0]?.content || data;
    const extracted = extractImageFromChatMessage(msgObject);
    console.log("Extraction Result:", extracted ? `Type: ${extracted.type}, Length: ${extracted.value.length}` : "NULL");
  } catch(e) {
    console.error("Parse Error:", e.message);
  }
} else {
  console.log("No data found in output.");
}
