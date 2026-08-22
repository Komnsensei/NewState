'use strict';
/**
 * Offline verifier for SCC v0. No provider calls.
 */
const crypto = require('crypto');
const { FLOOR_TARGET } = require('./mint.cjs');

function sha256(obj) {
  const canonical = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function verify(cert) {
  const failures = [];
  const checks = {};

  if (!cert || cert.type !== 'newstate.scc') {
    failures.push('V0: missing or invalid type newstate.scc');
  }

  if (cert && cert.certificateHash) {
    const copy = { ...cert };
    delete copy.certificateHash;
    const recomputed = sha256(copy);
    checks.hashMatch = recomputed === cert.certificateHash;
    if (!checks.hashMatch) failures.push('V1: certificateHash mismatch (tamper)');
  } else {
    checks.hashMatch = false;
    failures.push('V1: certificateHash missing');
  }

  checks.evidenceRecorded = cert?.evidence?.mode === 'recorded';
  if (!checks.evidenceRecorded) failures.push('V2: evidence.mode must be recorded');

  checks.ledgerAppendOnly = cert?.ledger?.appendOnly === true && cert?.ledger?.rule === 'R-019';
  if (!checks.ledgerAppendOnly) failures.push('V3: ledger must be append-only R-019');

  checks.hasIrreversibleScar =
    !!cert?.scar && cert.scar.irreversible === true && !!cert.scar.capabilityWithheld;
  if (cert?.status === 'full' && !checks.hasIrreversibleScar) {
    failures.push('V4: full SCC requires irreversible scar');
  }

  checks.floorTarget =
    cert?.floor?.condensedTarget === FLOOR_TARGET || cert?.floor?.condensedTarget === 0.7;
  if (!checks.floorTarget) failures.push('V5: floor.condensedTarget must be 0.7');

  checks.dualRegister =
    cert?.dualRegister?.cruciblePresent === true &&
    cert?.dualRegister?.disclosurePresent === true;
  if (cert?.status === 'full' && !checks.dualRegister) {
    failures.push('V6: full SCC requires dual-register both present');
  }

  checks.nonClaims = Array.isArray(cert?.nonClaims) && cert.nonClaims.length >= 2;
  if (!checks.nonClaims) failures.push('V7: nonClaims must be present');

  const ok = failures.length === 0;
  return {
    ok,
    status: ok ? (cert.status === 'full' ? 'VALID_FULL' : 'VALID_PARTIAL') : 'INVALID',
    failures,
    checks
  };
}

module.exports = { verify, sha256 };
