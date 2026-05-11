const express = require("express");
const router  = express.Router();
const { resetSystem, verifyChain } = require("../controllers/systemController");
const { adminApiKey } = require("../middleware/apiKey");  // SEC-02

// SEC-02: Reset uses a separate admin key — a leaked read key
// cannot trigger data deletion
router.post("/reset", adminApiKey, resetSystem);

// Verify blockchain log chain integrity
router.get("/verify-chain", verifyChain);

module.exports = router;