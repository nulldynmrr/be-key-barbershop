const { PrismaClient } = require("@prisma/client");

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error", "warn"],
  });

  // Query performance middleware for auditing bottlenecks
  if (process.env.NODE_ENV === "development") {
    client.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      console.log(`[Prisma Query] ${params.model}.${params.action} took ${after - before}ms`);
      return result;
    });
  }

  return client;
};

const prisma = global.prismaGlobal || prismaClientSingleton();

// Test connection on startup
prisma.$connect()
  .then(() => console.log("[Prisma] Database connected successfully"))
  .catch((err) => {
    console.error("[Prisma] Database connection failed:", err.message);
    process.exit(1); // Fail fast in enterprise environments
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

module.exports = prisma;
