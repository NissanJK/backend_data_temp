/**
 * middleware/apiKey.js
 * ─────────────────────────────────────────────────────────────
 * FIX: The global apiKey middleware previously only accepted
 * API_KEY. The reset button sends ADMIN_API_KEY (a different
 * value), so it was being rejected at the global middleware
 * layer before it even reached the adminApiKey route check.
 *
 * Flow for reset:
 *   POST /api/system/reset
 *     → app.use("/api", apiKey)           ← was rejecting ADMIN_API_KEY
 *     → router.post("/reset", adminApiKey) ← never reached
 *
 * Fix: apiKey now accepts either API_KEY or ADMIN_API_KEY.
 * adminApiKey still only accepts ADMIN_API_KEY, so the reset
 * route is still exclusively admin-protected end-to-end.
 */

const apiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];

  // Accept the regular key OR the admin key — the admin key is
  // a superset of permissions and must pass the global check too
  const isValid =
    (process.env.API_KEY       && key === process.env.API_KEY)       ||
    (process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY);

  if (!key || !isValid) {
    return res.status(401).json({ message: "Unauthorized: invalid or missing API key" });
  }

  next();
};

/**
 * adminApiKey — stricter check for destructive operations.
 * Only accepts ADMIN_API_KEY. Applied on POST /api/system/reset.
 */
const adminApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];

  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: "Unauthorized: admin key required for this operation" });
  }

  next();
};

module.exports = { apiKey, adminApiKey };