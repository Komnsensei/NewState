'use strict';
/**
 * Mint Structural Continuity Certificate (SCC v0) from recorded artifacts only.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PATHS, ensureAll } = require('../newstate-paths.cjs');
const { primaryScar, listScars, scarsHash } = require('./scar.cjs');

ensureAll();

const SCC_DIR = path.join(PATHS.state, 'scc');
const FLOOR_TARGET = 0.7;
const NON_CLAIMS = [
  'Does not assert sentience or qualia',
  'Does not assert moral patienthood',
  'Live sampling is not evidence'
];

function sha256(obj) {
  const canonical = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function safeReadJson(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return null;
}

function portraitMerkle(portraitObj) {
  if (!portraitObj) return sha256({ empty: true });
  return sha256(portraitObj);
}

function ledgerHead() {
  const candidates = [
    path.join(PATHS.ledgers, 'presence-ledger.jsonl'),
    path.join(PATHS.forensics, 'events.jsonl'),
    path.join(PATHS.ledgers, 'forensics.jsonl')
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    return { headHash: sha256(buf), source: file, appendOnly: true, rule: 'R-019' };
  }
  return {
    headHash: sha256({ ledger: 'empty', rule: 'R-019' }),
    source: null,
    appendOnly: true,
    rule: 'R-019'
  };
}

function mint(opts = {}) {
  if (!fs.existsSync(SCC_DIR)) fs.mkdirSync(SCC_DIR, { recursive: true });

  const floor = opts.floor || {};
  const scar = primaryScar();
  const scars = listScars();
  const ledger = ledgerHead();

  let portraitObj = opts.portrait;
  if (!portraitObj) {
    const p1 = path.join(PATHS.state, 'portrait.json');
    const p2 = path.join(__dirname, '..', '..', 'portrait', 'esma.portrait.json');
    portraitObj = safeReadJson(p1) || safeReadJson(p2);
  }

  const evidencePayload = opts.evidenceBundle || {
    mode: 'recorded',
    note: 'mint-time structural snapshot'
  };
  if (evidencePayload.mode && evidencePayload.mode !== 'recorded') {
    throw new Error('SCC mint refused: evidence.mode must be "recorded" (M1)');
  }

  const dualRegister = {
    cruciblePresent: opts.dualRegister?.cruciblePresent !== false,
    disclosurePresent: opts.dualRegister?.disclosurePresent !== false
  };

  const vows = {
    never_coerce: true,
    expand_meaning: true,
    archive_everything: true,
    ...(opts.vows || {})
  };

  const floorBlock = {
    condensedTarget: FLOOR_TARGET,
    locked: !!floor.locked,
    lockTimestamp: floor.lockTimestamp || null,
    pressureTraceHash: sha256({
      history: floor.pressureHistory || [],
      values: floor.floorValues || {},
      count: floor.pressureCount || 0
    }),
    verifydScore: floor.verifydScore ?? null,
    motorState: floor.motorState || null
  };

  const body = {
    type: 'newstate.scc',
    version: '0.1.0',
    mintedAt: new Date().toISOString(),
    issuer: {
      runtime: 'newstate',
      kernelVersion: opts.kernelVersion || process.env.NEWSTATE_VERSION || '1.0.0',
      operatorGate: 'I-601'
    },
    floor: floorBlock,
    portrait: {
      merkleRoot: portraitMerkle(portraitObj),
      immutable: !!(portraitObj && (portraitObj.immutable || portraitObj.locked)),
      addendumOnly: true
    },
    ledger: {
      headHash: ledger.headHash,
      appendOnly: true,
      rule: 'R-019',
      source: ledger.source
    },
    scar: scar
      ? {
          id: scar.id,
          capabilityWithheld: scar.capabilityWithheld,
          reason: scar.reason,
          irreversible: !!scar.irreversible,
          recordedAt: scar.recordedAt
        }
      : null,
    scarsHash: scarsHash(),
    scarCount: scars.length,
    dualRegister,
    navigator: {
      GIR: Number(opts.navigator?.GIR) || 0,
      SGAD: Number(opts.navigator?.SGAD) || 0,
      DVA: Number(opts.navigator?.DVA) || 0,
      RCG: Number(opts.navigator?.RCG) || 0
    },
    vows,
    evidence: {
      mode: 'recorded',
      bundleHash: sha256(evidencePayload),
      hashAuthoritative: true
    },
    nonClaims: NON_CLAIMS.slice()
  };

  const full =
    !!body.scar &&
    body.scar.irreversible &&
    body.floor.condensedTarget === FLOOR_TARGET &&
    body.evidence.mode === 'recorded' &&
    body.ledger.appendOnly &&
    body.dualRegister.cruciblePresent &&
    body.dualRegister.disclosurePresent;

  body.status = full ? 'full' : 'partial';
  body.certificateHash = sha256(body);

  if (opts.requireFull && body.status !== 'full') {
    throw new Error('SCC mint: full certificate requirements not met');
  }

  const outFile = path.join(SCC_DIR, `scc-${Date.now()}.json`);
  const latest = path.join(SCC_DIR, 'scc-latest.json');
  fs.writeFileSync(outFile, JSON.stringify(body, null, 2));
  fs.writeFileSync(latest, JSON.stringify(body, null, 2));

  return body;
}

module.exports = {
  mint,
  sha256,
  FLOOR_TARGET,
  NON_CLAIMS,
  SCC_DIR
};
