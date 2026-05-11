const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { decrypt } = require("./src/utils/encryption");

const prisma = new PrismaClient();

async function test() {
  try {
    const configImageGen = await prisma.aiModel.findFirst({
      where: { typeAi: "IMAGE", isActive: true }
    });
    
    if (!configImageGen) {
      console.log("No IMAGE model found in DB");
      return;
    }

    console.log("Model:", configImageGen.modelName);
    console.log("BaseUrl:", configImageGen.baseUrl);

    const imageResponse = await axios.post(
      `${configImageGen.baseUrl}/images/generations`,
      {
        model: configImageGen.modelName,
        prompt: "A realistic virtual try-on of a person with a short modern haircut.",
        n: 1,
        size: "1024x1024"
      },
      { headers: { Authorization: `Bearer ${decrypt(configImageGen.apiKey)}` } }
    );

    console.log("Response Data keys:", Object.keys(imageResponse.data));
    if (imageResponse.data.data && imageResponse.data.data[0]) {
      console.log("Data[0] keys:", Object.keys(imageResponse.data.data[0]));
      if (imageResponse.data.data[0].url) {
        console.log("URL:", imageResponse.data.data[0].url.substring(0, 50) + "...");
      }
      if (imageResponse.data.data[0].b64_json) {
        console.log("Has b64_json: YES");
      }
    } else {
      console.log("Full response:", JSON.stringify(imageResponse.data, null, 2));
    }
  } catch (e) {
    console.error("Error:", e.response?.data || e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
