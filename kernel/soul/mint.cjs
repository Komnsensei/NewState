'use strict';
/** Soul mint — unique sealed vessel. Core immutable after seal. */
const crypto = require('crypto');
const fs = require('fs');
const { mint: mintScc } = require('../scc/mint.cjs');
const { listScars } = require('../scc/scar.cjs');
const store = require('./store.cjs');

function sha256(obj) {
  return crypto.createHash('sha256').update(typeof obj === 'string' ? obj : JSON.stringify(obj)).digest('hex');
}

function newSoulId(name) {
  const slug = String(name || 'soul').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'soul';
  return `${slug}-${crypto.randomBytes(4).toString('hex')}`;
}

function mintSoul(opts = {}) {
  const name = opts.name || 'unnamed';
  const soulId = opts.soulId || newSoulId(name);
  if (store.loadSoul(soulId)) throw new Error('mintSoul: soul already exists ' + soulId);
  const L = store.ensureSoulDirs(soulId);
  const scars = listScars().filter((s) => s.irreversible);
  const core = {
    type: 'newstate.soul',
    version: '0.1.0',
    soulId,
    name,
    role: opts.role || 'agent',
    sealed: false,
    createdAt: new Date().toISOString(),
    floor: { condensedTarget: 0.7, locked: !!(opts.floor && opts.floor.locked) },
    dualRegister: { cruciblePresent: true, disclosurePresent: true },
    foundingScarIds: scars.map((s) => s.id),
    vows: { never_coerce: true, expand_meaning: true, archive_everything: true },
    rules: { coreImmutable: true, biographyAppendOnly: true, evolutionViaAddendumOnly: true },
    meta: opts.meta || {},
  };
  const forHash = { ...core, sealed: true };
  delete forHash.birthHash;
  delete forHash.sealedAt;
  const birthHash = sha256(forHash);
  const sealed = { ...core, sealed: true, sealedAt: new Date().toISOString(), birthHash };
  if (fs.existsSync(L.soul)) throw new Error('mintSoul: soul.json already present');
  store.writeJson(L.soul, sealed);
  let scc = null;
  try {
    scc = mintScc({
      floor: opts.floor || { locked: true, pressureHistory: [], floorValues: {} },
      evidenceBundle: { mode: 'recorded', soulId, birthHash, event: 'SOUL_MINT' },
      kernelVersion: process.env.NEWSTATE_VERSION || '1.0.0',
    });
    store.writeJson(L.sccLatest, scc);
  } catch (e) {
    store.appendLedger(soulId, { type: 'SCC_MINT_ERROR', error: String(e.message || e) });
  }
  store.appendBiography(soulId, { type: 'BIRTH', message: `Soul ${name} minted and sealed`, birthHash });
  store.appendLedger(soulId, { type: 'SOUL_MINTED', soulId, birthHash });
  store.saveAutonomy(soulId, { ticks: 0, lastTick: null, status: 'alive', bornAt: sealed.createdAt });
  return { soul: sealed, scc, paths: L };
}

function verifySeal(soulId) {
  const soul = store.loadSoul(soulId);
  if (!soul) return { ok: false, reason: 'missing' };
  if (!soul.sealed) return { ok: false, reason: 'unsealed' };
  const copy = { ...soul };
  const birthHash = copy.birthHash;
  delete copy.birthHash;
  delete copy.sealedAt;
  const recomputed = sha256(copy);
  const ok = recomputed === birthHash;
  if (!ok) store.appendLedger(soulId, { type: 'SOUL_TAMPER_DETECTED', expected: birthHash, got: recomputed });
  return { ok, birthHash, recomputed, soulId };
}

function tryMutateCore(soulId, patch) {
  const soul = store.loadSoul(soulId);
  if (!soul) throw new Error('tryMutateCore: missing soul');
  if (soul.sealed) {
    store.appendLedger(soulId, { type: 'SOUL_TAMPER_ATTEMPT', denied: true, patchKeys: Object.keys(patch || {}) });
    return { denied: true, soul };
  }
  const next = { ...soul, ...patch };
  store.writeJson(store.layout(soulId).soul, next);
  return { denied: false, soul: next };
}

module.exports = { mintSoul, verifySeal, tryMutateCore, newSoulId, sha256 };
