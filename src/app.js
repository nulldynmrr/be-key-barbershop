const express = require("express");
const cors = require("cors");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const hpp = require("hpp");
const pino = require("pino-http")();
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler.middleware");
const { requestId, globalLimiter } = require("./middleware/security.middleware");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const app = express();
app.set("trust proxy", 1);

// 1. Security Headers & Protection
app.use(helmet());
app.use(hpp());
app.use(compression());

// 2. Request Correlation & Logging
app.use(requestId);
app.use(pino);

// 3. CORS & Parsing
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"]
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 4. Rate Limiting
app.use(globalLimiter);

// 5. Static Files & Routes
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/v1", routes);

app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerUrl: "/api-docs.json",
  }),
);

app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: "Endpoint API tidak ditemukan" });
});

app.use(errorHandler);

module.exports = app;
