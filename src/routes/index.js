const express = require("express");
const router = express.Router();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../config/swagger");

const authRoutes = require("./auth.routes");
const serviceRoutes = require("./service.routes");
const aiConfigRoutes = require("./aiconfig.routes");
const aiRoutes = require("./ai.routes");
const barberRoutes = require("./barber.routes");
const paymentRoutes = require("./payment.routes");
const dashboardRoutes = require("./dashboard.routes");
const adminBillingRoutes = require("./adminBilling.routes");
const adminRoutes = require("./admin.routes");
const userRoutes = require("./user.routes");
const packageRoutes = require("./package.routes");

router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
router.use("/auth", authRoutes);
router.use("/services", serviceRoutes);
router.use("/ai-config", aiConfigRoutes);
router.use("/ai", aiRoutes);
router.use("/barbers", barberRoutes);
router.use("/payments", paymentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/admin-billing", adminBillingRoutes);
router.use("/admin", adminRoutes);
router.use("/users", userRoutes);
router.use("/api/v1/packages", packageRoutes);

module.exports = router;
