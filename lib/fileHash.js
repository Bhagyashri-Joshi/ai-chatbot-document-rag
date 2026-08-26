// lib/fileHash.js
// Responsible for: computing a content hash for uploaded files, used to
// detect duplicate uploads before re-processing/re-embedding a document
// the user (or another one) already uploaded (TRD section 18/57).

import crypto from "crypto";

/**
 * @param {Buffer} buffer
 * @returns {string} hex-encoded sha256 hash
 */
export function hashFileBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export default { hashFileBuffer };
