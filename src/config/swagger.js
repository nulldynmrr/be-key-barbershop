const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Key Barber API",
      version: "1.0.0",
      description: "API Documentation for Key Barber Backend",
    },
    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.routes.js"],
};

function buildSwaggerSpec() {
  try {
    const spec = swaggerJsdoc(options);
    console.log("Swagger loaded:", Object.keys(spec.paths));
    return spec;
  } catch (err) {
    console.error("[swagger] failed:", err.message);
    return {
      ...options.definition,
      paths: {},
    };
  }
}

module.exports = buildSwaggerSpec();
