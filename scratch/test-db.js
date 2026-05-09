const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.aiModel.findMany().then(console.log).catch(console.error).finally(() => p.$disconnect());
