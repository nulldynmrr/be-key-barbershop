const express = require("express");
const router = express.Router();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../config/swagger");

const r = (mod) => mod.default || mod;

const authRoutes = r(require("./auth.routes"));
const serviceRoutes = r(require("./service.routes"));
const aiConfigRoutes = r(require("./aiconfig.routes"));
const aiRoutes = r(require("./ai.routes"));
const barberRoutes = r(require("./barber.routes"));
const paymentRoutes = r(require("./payment.routes"));
const dashboardRoutes = r(require("./dashboard.routes"));
const adminBillingRoutes = r(require("./adminBilling.routes"));
const adminRoutes = r(require("./admin.routes"));
const userRoutes = r(require("./user.routes"));
const packageRoutes = r(require("./package.routes"));
const notificationRoutes = r(require("./notification.routes"));
const socialMediaRoutes = r(require("./socialmedia.routes"));
const galleryRoutes = r(require("./gallery.routes"));

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
router.use("/packages", packageRoutes);
router.use("/notifications", notificationRoutes);
router.use("/social-media", socialMediaRoutes);
router.use("/gallery", galleryRoutes);

module.exports = router;
