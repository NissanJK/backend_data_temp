/**
 * utils/SmartContract.js
 * ─────────────────────────────────────────────────────────────
 * Simulates smart contract behaviour for DataTrust-SC.
 *
 * Security patch (SEC-09):
 *   Policy strings are capped at 500 characters in the
 *   constructor. A 100k-clause policy caused ~68ms of CPU work
 *   per evaluation — stackable into server exhaustion under
 *   concurrent load. Rejection at deploy time prevents the
 *   policy from ever reaching the evaluator.
 */

const crypto = require("crypto");

const MAX_POLICY_LENGTH = 500;

class PolicyContract {
  constructor(policy, owner, dataHash) {
    if (!policy || !owner || !dataHash) {
      throw new Error("PolicyContract: policy, owner, and dataHash are required to deploy.");
    }

    // SEC-09: reject oversized policy strings at deploy time
    if (policy.length > MAX_POLICY_LENGTH) {
      throw new Error(
        `PolicyContract: policy exceeds maximum length of ${MAX_POLICY_LENGTH} characters.`
      );
    }

    this.contractId = crypto
      .createHash("sha256")
      .update(policy + owner + dataHash + Date.now())
      .digest("hex");

    this.deployedAt  = new Date().toISOString();
    this.owner       = owner;
    this.dataHash    = dataHash;

    this._policy     = Object.freeze({ raw: policy });
    this._executions = [];
  }

  get policy()     { return this._policy.raw; }
  get executions() { return [...this._executions]; }

  execute(role, attribute) {
    if (!role || !attribute) {
      throw new Error("PolicyContract.execute(): role and attribute are required.");
    }

    const granted = this._evaluatePolicy(role, attribute);

    const event = {
      contractId:  this.contractId,
      dataHash:    this.dataHash,
      policy:      this._policy.raw,
      role,
      attribute,
      granted,
      executedAt:  new Date().toISOString()
    };

    this._executions.push(event);
    return event;
  }

  _evaluatePolicy(role, attribute) {
    const policy = this._policy.raw;
    if (!policy) return false;

    const orClauses = policy.split(/\s+OR\s+/i).map(c => c.trim());

    for (const clause of orClauses) {
      const andParts = clause.split(/\s+AND\s+/i).map(p => p.trim());
      let allMet = true;

      for (const part of andParts) {
        if (part.startsWith("role:")) {
          if (role !== part.replace("role:", "").trim()) { allMet = false; break; }
        } else if (part.startsWith("attribute:")) {
          if (attribute !== part.replace("attribute:", "").trim()) { allMet = false; break; }
        }
      }

      if (allMet) return true;
    }

    return false;
  }

  toJSON() {
    return {
      contractId:     this.contractId,
      deployedAt:     this.deployedAt,
      owner:          this.owner,
      dataHash:       this.dataHash,
      policy:         this._policy.raw,
      executionCount: this._executions.length
    };
  }
}

module.exports = PolicyContract;