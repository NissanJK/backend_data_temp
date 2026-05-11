const Dataset            = require("../models/Dataset");
const BlockchainLog      = require("../models/BlockchainLog");
const { decrypt }        = require("../utils/crypto");
const PolicyContract     = require("../utils/SmartContract");
const { computeEntryHash } = require("../utils/chainVerifier");

const getChainTip = async () => {
  const last = await BlockchainLog
    .findOne()
    .sort({ chainIndex: -1 })
    .lean();

  if (!last) {
    return { chainIndex: 0, previousHash: "0".repeat(64) };
  }

  const chainIndex = (typeof last.chainIndex === "number" && !isNaN(last.chainIndex))
    ? last.chainIndex + 1
    : 0;

  return {
    chainIndex,
    previousHash: last.entryHash || "0".repeat(64)
  };
};

// ── SEC-09: Policy length cap ─────────────────────────────
// A policy with 100k OR clauses takes ~68ms to evaluate.
// Cap at 500 chars — more than enough for any real policy.
const MAX_POLICY_LENGTH = 500;

/* ─────────────────────────────────────────────────────────────
   REQUEST ACCESS
───────────────────────────────────────────────────────────── */
exports.requestAccess = async (req, res) => {
  try {
    const { category, role, attribute } = req.body;

    // SEC-03: Reject non-string inputs — prevents NoSQL injection
    // Sending {"$gt": ""} as category would otherwise match ALL documents.
    if (
      typeof category  !== "string" ||
      typeof role      !== "string" ||
      typeof attribute !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid input: category, role, and attribute must be plain strings"
      });
    }

    if (!category.trim() || !role.trim() || !attribute.trim()) {
      return res.status(400).json({
        message: "Missing required fields: category, role, and attribute are required"
      });
    }

    // SEC-03: Strip any $ or . characters that could be MongoDB operators
    const safeCategory  = category.replace(/[$.\x00]/g, "");
    const safeRole      = role.replace(/[$.\x00]/g, "");
    const safeAttribute = attribute.replace(/[$.\x00]/g, "");

    const datasets = await Dataset.find({ "metadata.Data_Category": safeCategory });

    if (!datasets.length) {
      return res.status(404).json({
        message: `No datasets found for category: ${safeCategory}`
      });
    }

    const grantedRecords = [];
    let decryptErrors = 0;

    for (const record of datasets) {
      // SEC-09: Skip records whose stored policy exceeds the length cap.
      // This guards against malicious policies injected via CSV import.
      if (record.policy && record.policy.length > MAX_POLICY_LENGTH) {
        console.warn(`Skipping record ${record.hash} — policy exceeds max length`);
        continue;
      }

      const contract = new PolicyContract(record.policy, record.ownerRole, record.hash);
      const event    = contract.execute(safeRole, safeAttribute);

      console.log(
        `📜 Contract ${contract.contractId.substring(0, 12)}... executed → granted: ${event.granted}`
      );

      const { chainIndex, previousHash } = await getChainTip();

      const logData = {
        type:         "ACCESS_REQUEST",
        hash:         record.hash,
        role:         safeRole,
        attribute:    safeAttribute,
        policy:       record.policy,
        granted:      event.granted,
        contractId:   contract.contractId,
        chainIndex,
        previousHash,
        timestamp:    new Date()
      };

      const entryHash = computeEntryHash({ ...logData, chainIndex, timestamp: logData.timestamp });
      await BlockchainLog.create({ ...logData, entryHash });

      if (event.granted) {
        try {
          const decryptedData = decrypt(record.encryptedPayload);
          grantedRecords.push({ hash: record.hash, data: decryptedData });
        } catch (decryptError) {
          console.error("Decryption error for record", record.hash, ":", decryptError);
          decryptErrors++;
        }
      }
    }

    if (!grantedRecords.length && decryptErrors === 0) {
      return res.status(403).json({
        message: "Access denied: Policy requirements not met for any records"
      });
    }

    if (!grantedRecords.length && decryptErrors > 0) {
      return res.status(500).json({
        message: `Access was granted but all ${decryptErrors} record(s) failed to decrypt`
      });
    }

    res.json({
      category: safeCategory,
      count:         grantedRecords.length,
      records:       grantedRecords,
      decryptErrors: decryptErrors > 0 ? decryptErrors : undefined
    });

  } catch (error) {
    console.error("Access request error:", error);
    res.status(500).json({ message: "Internal server error during access request" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET LOGS
   SEC-08: Paginated so the full audit trail can't be dumped
   in a single request. Default: last 100 entries.
   Query params: ?page=0&limit=100
───────────────────────────────────────────────────────────── */
exports.getLogs = async (req, res) => {
  try {
    const page  = Math.max(0, parseInt(req.query.page)  || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));

    const logs = await BlockchainLog
      .find()
      .sort({ timestamp: -1 })
      .skip(page * limit)
      .limit(limit);

    const total = await BlockchainLog.countDocuments();

    res.json({
      logs,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ message: "Failed to retrieve logs" });
  }
};