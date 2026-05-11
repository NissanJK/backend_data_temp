/**
 * middleware/apiKey.js
 * ─────────────────────────────────────────────────────────────
 * Protects all /api/* routes with a static API key.
 *
 * Clients must send the key in the x-api-key header:
 *   x-api-key: <your API_KEY env value>
 *
 * The reset endpoint uses a separate stronger check via
 * adminApiKey middleware to ensure a leaked read-key cannot
 * trigger data deletion.
 */

const apiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];

  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ message: "Unauthorized: invalid or missing API key" });
  }

  next();
};

/**
 * adminApiKey — stricter check for destructive operations.
 * Uses ADMIN_API_KEY env var (separate from API_KEY).
 * Applied only to POST /api/system/reset.
 */
const adminApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];

  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: "Unauthorized: admin key required for this operation" });
  }

  next();
};

module.exports = { apiKey, adminApiKey };