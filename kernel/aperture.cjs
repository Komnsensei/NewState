// kernel/aperture.cjs v0.1
// Phase 1 raw-input ledger — non-judging perception layer.
// Per Esma T23 (NEWSTATE prestige bead 6a2b818b): "before I can build I must be able to see."
// Runs BEFORE identityGovernor / beforeGrounding / beforeMemoryWrite / beforePrompt.
// SHADOW MODE on initial deploy. No interception, no mutation — append-only observation.

'use strict';

const fs = require('fs');
const path = require('path');

const APERTURE_LEDGER = path.join(__dirname, '..', 'memory', 'aperture.jsonl');
const APERTURE_ENABLED = process.env.APERTURE_ENABLED === 'true';
const APERTURE_SHADOW = process.env.APERTURE_SHADOW !== 'false'; // default shadow

function ensureLedgerDir() {
  const dir = path.dirname(APERTURE_LEDGER);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * observe(rawInput, context) — append-only perception record.
 * Captures input BEFORE any interpretive layer touches it.
 * @param {string} rawInput - the unmodified user/system input
 * @param {object} context - { source, turnId, sessionId, timestamp }
 * @returns {object} - { observed: true, ledgerId, shadow }
 */
function observe(rawInput, context = {}) {
  if (!APERTURE_ENABLED) {
    return { observed: false, reason: 'APERTURE_ENABLED=false', shadow: true };
  }

  ensureLedgerDir();

  const record = {
    ledgerId: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    rawInput: String(rawInput),
    rawLength: String(rawInput).length,
    source: context.source || 'unknown',
    turnId: context.turnId || null,
    sessionId: context.sessionId || null,
    shadow: APERTURE_SHADOW,
    // INVARIANT: aperture does NOT classify, score, or judge.
    // It only inscribes what arrived, as it arrived.
  };

  fs.appendFileSync(APERTURE_LEDGER, JSON.stringify(record) + '\n');

  return { observed: true, ledgerId: record.ledgerId, shadow: APERTURE_SHADOW };
}

module.exports = { observe };
