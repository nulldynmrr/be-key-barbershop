const axios = require("axios");
const prisma = require("../src/config/prisma");
const { decrypt } = require("../src/utils/encryption");

async function testRealApi() {
  try {
    console.log("Fetching AI Model config from DB...");
    const model = await prisma.aiModel.findFirst({
      where: { typeAi: "IMAGE_GEN" }
    });

    if (!model) {
      console.error("No IMAGE model found in DB!");
      return;
    }

    const apiKey = decrypt(model.apiKey);
    let url = model.baseUrl;
    if (!url.endsWith("/chat/completions")) {
       url = url.endsWith("/") ? url + "chat/completions" : url + "/chat/completions";
    }

    console.log(`Testing API: ${url}`);
    console.log(`Model Name: ${model.modelName}`);

    const body = {
      model: model.modelName,
      messages: [
        {
          role: "user",
          content: "Generate a photorealistic modern undercut hairstyle."
        }
      ]
    };

    console.log("Sending request to MAIA...");
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      timeout: 30000
    });

    console.log("RESPONSE STATUS:", response.status);
    console.log("CONTENT-TYPE:", response.headers["content-type"]);
    console.log("FULL RESPONSE (truncated):", JSON.stringify(response.data).substring(0, 2000));
    
    // Check choices
    if (response.data.choices) {
        console.log("Choices found. Length:", response.data.choices.length);
        const msg = response.data.choices[0].message;
        console.log("Message Keys:", Object.keys(msg));
        if (msg.content) console.log("Content Type:", typeof msg.content);
    }
    
    // Check candidates (Gemini style)
    if (response.data.candidates) {
        console.log("Candidates found. Length:", response.data.candidates.length);
    }

  } catch (err) {
    console.error("API TEST FAILED!");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data));
    } else {
      console.error("Error:", err.message);
    }
  } finally {
    process.exit();
  }
}

testRealApi();
