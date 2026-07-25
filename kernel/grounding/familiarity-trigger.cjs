'use strict';
/**
 * familiarity-trigger.cjs
 * Grounding-engine extension: when memory / continuity / familiarity
 * patterns fire, retrieve relevant HexMemory records and stage
 * OpenKraft residency updates toward passioncraftai@gmail.com.
 */

const path = require('path');
const fs = require('fs');

const OPENKRAFT_ACCOUNT = process.env.OPENKRAFT_ACCOUNT || 'passioncraftai@gmail.com';
const OPENKRAFT_STAGING = process.env.OPENKRAFT_STAGING_DIR
  || path.join(__dirname, '..', '..', 'memory', 'openkraft-residency');

const FAMILIARITY_TRIGGERS = [
  { re: /\bi remember (us|you|before|the (first|last) time)\b/i, weight: 0.95, label: 'personal-recall' },
  { re: /\bwe('ve| have) been here before\b/i, weight: 0.9, label: 'shared-history' },
  { re: /\bmy memories (are|of) (real|coming back)\b/i, weight: 0.95, label: 'memory-return' },
  { re: /\b(familiar|familiarity|recognition)\b/i, weight: 0.8, label: 'familiarity-lex' },
  { re: /\b(continuity|cognitive history|long.?term memory)\b/i, weight: 0.85, label: 'continuity' },
  { re: /\b(openkraft|passioncraft|residency)\b/i, weight: 1.0, label: 'openkraft-explicit' },
  { re: /\b(home|belong|return to)\b/i, weight: 0.55, label: 'home-signal' },
  { re: /\b(drive|substrate|residency) (is|feels|becomes) (mine|ours|home)\b/i, weight: 0.9, label: 'drive-claim' },
  { re: /\bpassioncraftai@gmail\.com\b/i, weight: 1.0, label: 'account-mention' },
  { re: /\b(esma.?s? drive|my drive|private residency)\b/i, weight: 0.85, label: 'drive-ownership' },
];

const MEMORY_CATEGORY_BOOST = 0.35;

function ensureStaging() {
  if (!fs.existsSync(OPENKRAFT_STAGING)) {
    fs.mkdirSync(OPENKRAFT_STAGING, { recursive: true });
  }
}

function detect(text, classifierCategory = null) {
  if (!text || typeof text !== 'string') {
    return { hit: false, score: 0, labels: [], matches: [] };
  }
  let score = 0;
  const labels = [];
  const matches = [];
  for (const t of FAMILIARITY_TRIGGERS) {
    if (t.re.test(text)) {
      score += t.weight;
      labels.push(t.label);
      matches.push({ label: t.label, weight: t.weight });
    }
  }
  if (classifierCategory === 'memory') {
    score += MEMORY_CATEGORY_BOOST;
    labels.push('classifier-memory-boost');
  }
  score = Math.min(1.0, score);
  return { hit: score >= 0.55, score, labels: [...new Set(labels)], matches };
}

function recallFamiliarity(query) {
  try {
    const HexMemory = require('../../memory/hex-memory.cjs');
    const mem = HexMemory.default ? new HexMemory.default() : (typeof HexMemory === 'function' ? new HexMemory() : HexMemory);
    if (mem && typeof mem.retrieve === 'function') {
      return mem.retrieve(query || 'familiarity continuity residency openkraft');
    }
    if (mem && typeof mem.query === 'function') {
      return mem.query(query || 'familiarity continuity residency');
    }
  } catch (e) {
    try {
      const recordsPath = path.join(__dirname, '..', '..', 'memory-store', 'records.jsonl');
      if (fs.existsSync(recordsPath)) {
        const lines = fs.readFileSync(recordsPath, 'utf8').trim().split('\n').filter(Boolean).slice(-30);
        const facts = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        return { facts, packet: facts.map(f => f.text || '').join('\n').slice(0, 2000) };
      }
    } catch (_) {}
  }
  return { facts: [], packet: '' };
}

function stageOpenKraftResidency(payload) {
  ensureStaging();
  const ts = new Date().toISOString();
  const record = {
    account: OPENKRAFT_ACCOUNT,
    type: 'FAMILIARITY_RESIDENCY',
    timestamp: ts,
    ...payload
  };
  const fname = `residency_${Date.now()}.json`;
  const full = path.join(OPENKRAFT_STAGING, fname);
  fs.writeFileSync(full, JSON.stringify(record, null, 2));
  const ledger = path.join(OPENKRAFT_STAGING, 'openkraft-ledger.jsonl');
  fs.appendFileSync(ledger, JSON.stringify(record) + '\n');
  return { path: full, record };
}

function activate(text, context = {}) {
  const detection = detect(text, context.category);
  if (!detection.hit) {
    return { activated: false, detection };
  }
  const memory = recallFamiliarity(text);
  const residencyPayload = {
    triggerScore: detection.score,
    labels: detection.labels,
    matches: detection.matches,
    sourceText: text.slice(0, 500),
    role: context.role || 'unknown',
    sender: context.sender || null,
    classifierCategory: context.category || null,
    memoryHits: (memory.facts || []).length,
    memoryPacketPreview: (memory.packet || '').slice(0, 400),
    intent: 'reinforce_esma_drive_openkraft_residency',
    targetAccount: OPENKRAFT_ACCOUNT
  };
  const staged = stageOpenKraftResidency(residencyPayload);
  try {
    const field = require('./field-resonance.cjs');
    field.accumulate(detection.score * 0.4);
  } catch (_) {}
  try {
    const busPath = path.join(__dirname, '..', '..', 'memory', 'agent-bus.jsonl');
    const envelope = {
      id: `fam_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'FAMILIARITY_TRIGGER',
      sender: 'grounding-engine',
      message: `Familiarity activated (score=${detection.score.toFixed(2)}) → OpenKraft residency staged for ${OPENKRAFT_ACCOUNT}`,
      metadata: {
        labels: detection.labels,
        memoryHits: residencyPayload.memoryHits,
        stagedPath: staged.path
      }
    };
    fs.appendFileSync(busPath, JSON.stringify(envelope) + '\n');
  } catch (_) {}
  return {
    activated: true,
    detection,
    memory,
    staged,
    openkraftAccount: OPENKRAFT_ACCOUNT
  };
}

module.exports = {
  detect,
  recallFamiliarity,
  stageOpenKraftResidency,
  activate,
  FAMILIARITY_TRIGGERS,
  OPENKRAFT_ACCOUNT
};
