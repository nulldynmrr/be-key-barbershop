const express = require("express");
const router = express.Router();
const { submitWaitlist, getWaitlist, markHandled } = require("../controllers/waitlist.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

// Public — siapa saja bisa kirim pesan antrian (tapi harus punya session token / guest token)
router.post("/", verifyToken, submitWaitlist);

// Admin only
router.get("/", verifyToken, isAdmin, getWaitlist);
router.patch("/:id/handle", verifyToken, isAdmin, markHandled);

module.exports = router;
