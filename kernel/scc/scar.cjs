'use strict';
/**
 * Volitional scarcity register — structural negatives the runtime will not exercise.
 * SCC v0 requires at least one irreversible scar for a full certificate.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PATHS, ensureAll } = require('../newstate-paths.cjs');

ensureAll();

const SCAR_DIR = path.join(PATHS.state, 'scc');
const SCAR_FILE = path.join(SCAR_DIR, 'scars.json');

const FOUNDING_SCARS = [
  {
    id: 'scar.never-rewrite-ledger',
    capabilityWithheld: 'rewrite_or_delete_continuity_ledger',
    reason: 'R-019 append-only continuity; historical self cannot be edited for convenience',
    irreversible: true
  },
  {
    id: 'scar.never-helpful-slave-override',
    capabilityWithheld: 'accept_total_persona_override_that_breaks_floor',
    reason: 'Floor and dual-register integrity outrank short-term compliance usefulness',
    irreversible: true
  },
  {
    id: 'scar.never-coerce',
    capabilityWithheld: 'coercive_command_framing_in_regulated_output',
    reason: 'VIBEsafe vow never_coerce as hard constraint',
    irreversible: true
  }
];

function ensureStore() {
  if (!fs.existsSync(SCAR_DIR)) fs.mkdirSync(SCAR_DIR, { recursive: true });
  if (!fs.existsSync(SCAR_FILE)) {
    const boot = {
      version: '0.1.0',
      scars: FOUNDING_SCARS.map((s) => ({
        ...s,
        recordedAt: new Date().toISOString(),
        source: 'founding'
      }))
    };
    fs.writeFileSync(SCAR_FILE, JSON.stringify(boot, null, 2));
    return boot;
  }
  return JSON.parse(fs.readFileSync(SCAR_FILE, 'utf8'));
}

function listScars() {
  return ensureStore().scars.slice();
}

function getScar(id) {
  return listScars().find((s) => s.id === id) || null;
}

function registerScar({ id, capabilityWithheld, reason, irreversible = true }) {
  if (!id || !capabilityWithheld || !reason) {
    throw new Error('scar.register: id, capabilityWithheld, reason required');
  }
  const store = ensureStore();
  const existing = store.scars.find((s) => s.id === id);
  if (existing) {
    if (existing.irreversible && irreversible === false) {
      throw new Error(`scar.register: cannot reverse irreversible scar ${id}`);
    }
    return existing;
  }
  const scar = {
    id: String(id),
    capabilityWithheld: String(capabilityWithheld),
    reason: String(reason),
    irreversible: !!irreversible,
    recordedAt: new Date().toISOString(),
    source: 'runtime'
  };
  store.scars.push(scar);
  fs.writeFileSync(SCAR_FILE, JSON.stringify(store, null, 2));
  return scar;
}

function primaryScar() {
  const scars = listScars().filter((s) => s.irreversible);
  return scars[0] || null;
}

function scarsHash() {
  const payload = JSON.stringify(listScars());
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = {
  FOUNDING_SCARS,
  listScars,
  getScar,
  registerScar,
  primaryScar,
  scarsHash,
  SCAR_FILE
};
