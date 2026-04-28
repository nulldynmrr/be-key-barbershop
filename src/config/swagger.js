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
    return swaggerJsdoc(options);
  } catch (err) {
    // Jangan bikin backend crash hanya karena anotasi Swagger error.
    // Spec minimal supaya server tetap bisa jalan.
    console.error("[swagger] failed to generate spec:", err?.message || err);
    return {
      ...options.definition,
      paths: {},
    };
  }
}

module.exports = buildSwaggerSpec();
