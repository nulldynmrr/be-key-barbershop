const express = require("express");
const router = express.Router();
const { submitWaitlist, getWaitlist, markHandled, deleteWaitlist } = require("../controllers/waitlist.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

router.post("/", verifyToken, submitWaitlist);

router.get("/", verifyToken, isAdmin, getWaitlist);
router.patch("/:id/handle", verifyToken, isAdmin, markHandled);
router.delete("/:id", verifyToken, isAdmin, deleteWaitlist);

module.exports = router;
