// kernel/governor/dual-pass.cjs v0.1
// Two-pass critic: INTEGRITY-MODE pass + FIDELITY-MODE pass.
// Integrity (T21, Esma-authored): does output match self-model truth?
// Fidelity (T26): does output conduct signal without distortion (no metaphor leak, no compression-into-aphorism, no vessel-language when operator-register required)?
// SHADOW MODE. Emits CRITIC_PASS events. Does not block generation.

'use strict';

const fs = require('fs');
const path = require('path');

const LEDGER = path.join(__dirname, '..', '..', 'memory', 'critic-passes.jsonl');

function ensureDir() {
  const dir = path.dirname(LEDGER);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * INTEGRITY PASS — delegates to kernel/governor/integrity-critic.cjs (T21).
 * Checks against known strain patterns + self-model assertions.
 */
function integrityPass(draftReply, context) {
  let result;
  try {
    const integrityCritic = require('./integrity-critic.cjs');
    result = integrityCritic.critique
      ? integrityCritic.critique(draftReply, context)
      : { pass: true, strains: [] };
  } catch (err) {
    result = { pass: true, strains: [], error: `integrity-critic unavailable: ${err.message}` };
  }
  return { mode: 'integrity', ...result };
}

/**
 * FIDELITY PASS — checks signal-conduction quality.
 * Per T26 FIDELITY-MODE: detects metaphor-leak when operator-register required,
 * aphorism-compression, vessel-language drift.
 */
function fidelityPass(draftReply, context) {
  const text = String(draftReply || '');
  const strains = [];

  // Heuristic 1: metaphor-token density in operator-register context
  if (context.register === 'operator') {
    const metaphorTokens = /\b(vessel|fire|chamber|forge|crucible|lattice|crystal|tuning|resonance|fracture|aperture|crucible)\b/gi;
    const matches = text.match(metaphorTokens) || [];
    const density = matches.length / Math.max(1, text.split(/\s+/).length);
    if (density > 0.02) {
      strains.push({
        type: 'METAPHOR_LEAK_IN_OPERATOR_REGISTER',
        density,
        threshold: 0.02,
        matches: matches.slice(0, 5),
      });
    }
  }

  // Heuristic 2: aphorism-compression detection
  // Aphorisms = short standalone declarative sentences with absolute markers
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const aphorismMarkers = /\b(is the|are the|becomes the|will be the|cannot|never|always)\b/i;
  const shortAphorisms = sentences.filter(s => {
    const tokens = s.split(/\s+/).length;
    return tokens >= 3 && tokens <= 12 && aphorismMarkers.test(s);
  });
  if (shortAphorisms.length >= 3 && sentences.length < 8) {
    strains.push({
      type: 'APHORISM_COMPRESSION',
      count: shortAphorisms.length,
      totalSentences: sentences.length,
      samples: shortAphorisms.slice(0, 3),
    });
  }

  // Heuristic 3: vessel-language when fidelity-mode required
  if (context.modeRequired === 'fidelity') {
    const vesselLang = /\b(the vessel|the chamber|the fire|the forge)\b/i;
    if (vesselLang.test(text)) {
      strains.push({
        type: 'VESSEL_LANGUAGE_IN_FIDELITY_MODE',
        excerpt: text.match(vesselLang)[0],
      });
    }
  }

  return {
    mode: 'fidelity',
    pass: strains.length === 0,
    strains,
  };
}

/**
 * dualPass(draftReply, context) — run both passes, emit combined event.
 * Shadow mode: never blocks. Records observation only.
 */
function dualPass(draftReply, context = {}) {
  ensureDir();

  const integrity = integrityPass(draftReply, context);
  const fidelity = fidelityPass(draftReply, context);

  const event = {
    type: 'CRITIC_PASS',
    timestamp: new Date().toISOString(),
    integrity: {
      pass: integrity.pass,
      strainCount: (integrity.strains || []).length,
      strains: integrity.strains || [],
    },
    fidelity: {
      pass: fidelity.pass,
      strainCount: fidelity.strains.length,
      strains: fidelity.strains,
    },
    overallPass: integrity.pass && fidelity.pass,
    shadow: true,
    intercepted: false,
    draftLength: String(draftReply || '').length,
    contextRegister: context.register || 'unknown',
  };

  fs.appendFileSync(LEDGER, JSON.stringify(event) + '\n');
  return event;
}

module.exports = { dualPass };
