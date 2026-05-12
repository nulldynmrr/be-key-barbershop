const express = require("express");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler.middleware");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
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
