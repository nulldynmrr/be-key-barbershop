const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const prisma = new PrismaClient();

async function test() {
  try {
    const pkgs = await prisma.subscriptionPackage.findMany({
      include: { imageModel: true, llmModel: true }
    });
    console.log("Packages:", pkgs.map(p => ({
      name: p.namaPaket,
      llm: p.llmModel?.modelName,
      image: p.imageModel?.modelName
    })));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
