/**
 * accessController.js  (updated)
 * ─────────────────────────────────────────────────────────────
 * Changes from original:
 *   1. requestAccess() now instantiates a PolicyContract per
 *      dataset and calls contract.execute() instead of the
 *      bare evaluatePolicy() function.
 *   2. Every access event is logged with contractId and full
 *      chain-linking fields (previousHash, entryHash, chainIndex).
 *   3. getLogs() is unchanged.
 */

const Dataset         = require("../models/Dataset");
const BlockchainLog   = require("../models/BlockchainLog");
const { decrypt }     = require("../utils/crypto");
const PolicyContract  = require("../utils/SmartContract");
const { computeEntryHash } = require("../utils/chainVerifier");

// ── Helper: next chain index + previous hash ───────────────
const getChainTip = async () => {
  const last = await BlockchainLog
    .findOne()
    .sort({ chainIndex: -1 })
    .lean();

  if (!last) {
    return { chainIndex: 0, previousHash: "0".repeat(64) };
  }

  return {
    chainIndex:   last.chainIndex + 1,
    previousHash: last.entryHash || "0".repeat(64)
  };
};

/* ─────────────────────────────────────────────────────────────
   REQUEST ACCESS
───────────────────────────────────────────────────────────── */
exports.requestAccess = async (req, res) => {
  try {
    const { category, role, attribute } = req.body;

    if (!category || !role || !attribute) {
      return res.status(400).json({
        message: "Missing required fields: category, role, and attribute are required"
      });
    }

    const datasets = await Dataset.find({ "metadata.Data_Category": category });

    if (!datasets.length) {
      return res.status(404).json({
        message: `No datasets found for category: ${category}`
      });
    }

    const grantedRecords = [];

    for (const record of datasets) {
      // ── Deploy a PolicyContract for this record's policy ──
      const contract = new PolicyContract(record.policy, record.ownerRole, record.hash);

      // ── Execute the contract — this IS the access check ──
      const event = contract.execute(role, attribute);

      console.log(
        `📜 Contract ${contract.contractId.substring(0, 12)}... executed → granted: ${event.granted}`
      );

      // ── Write chain-linked log entry ───────────────────────
      const { chainIndex, previousHash } = await getChainTip();

      const logData = {
        type:         "ACCESS_REQUEST",
        hash:         record.hash,
        role,
        attribute,
        policy:       record.policy,
        granted:      event.granted,
        contractId:   contract.contractId,
        chainIndex,
        previousHash,
        timestamp:    new Date()
      };

      const entryHash = computeEntryHash({
        ...logData,
        chainIndex,
        timestamp: logData.timestamp
      });

      await BlockchainLog.create({ ...logData, entryHash });

      // ── Decrypt and collect if granted ─────────────────────
      if (event.granted) {
        try {
          const decryptedData = decrypt(record.encryptedPayload);
          grantedRecords.push({ hash: record.hash, data: decryptedData });
        } catch (decryptError) {
          console.error("Decryption error:", decryptError);
        }
      }
    }

    if (!grantedRecords.length) {
      return res.status(403).json({
        message: "Access denied: Policy requirements not met for any records"
      });
    }

    res.json({
      category,
      count:   grantedRecords.length,
      records: grantedRecords
    });

  } catch (error) {
    console.error("Access request error:", error);
    res.status(500).json({ message: "Internal server error during access request" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET LOGS  (unchanged)
───────────────────────────────────────────────────────────── */
exports.getLogs = async (req, res) => {
  try {
    const logs = await BlockchainLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ message: "Failed to retrieve logs" });
  }
};