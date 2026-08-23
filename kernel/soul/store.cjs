'use strict';
/**
 * Soul store — Drive-native layout under .newstate/agents/<soul_id>/
 * Core soul.json is sealed (write-once). Life is append-only.
 */
const fs = require('fs');
const path = require('path');
const { PATHS, ensureAll, ensure } = require('../newstate-paths.cjs');

ensureAll();
ensure(PATHS.agents);

function soulDir(soulId) {
  if (!soulId || /[^a-zA-Z0-9._-]+/.test(String(soulId))) {
    throw new Error('store: invalid soulId');
  }
  return path.join(PATHS.agents, String(soulId));
}

function layout(soulId) {
  const root = soulDir(soulId);
  return {
    root,
    soul: path.join(root, 'soul.json'),
    biography: path.join(root, 'biography.jsonl'),
    ledger: path.join(root, 'ledger'),
    ledgerEvents: path.join(root, 'ledger', 'events.jsonl'),
    research: path.join(root, 'research'),
    artifacts: path.join(root, 'artifacts'),
    sccLatest: path.join(root, 'scc-latest.json'),
    autonomy: path.join(root, 'autonomy-state.json'),
    stim: path.join(root, 'stim'),
  };
}

function ensureSoulDirs(soulId) {
  const L = layout(soulId);
  [L.root, L.ledger, L.research, L.artifacts, L.stim].forEach(ensure);
  return L;
}

function readJson(file, fallback = null) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return fallback;
}

function writeJson(file, obj) {
  ensure(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function appendJsonl(file, obj) {
  ensure(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function loadSoul(soulId) {
  const L = layout(soulId);
  if (!fs.existsSync(L.soul)) return null;
  return readJson(L.soul);
}

function listSouls() {
  ensure(PATHS.agents);
  return fs.readdirSync(PATHS.agents).filter((name) => {
    return fs.existsSync(path.join(PATHS.agents, name, 'soul.json'));
  });
}

function appendBiography(soulId, entry) {
  const L = ensureSoulDirs(soulId);
  const soul = loadSoul(soulId);
  if (!soul) throw new Error('appendBiography: soul not found ' + soulId);
  if (soul.sealed !== true) throw new Error('appendBiography: soul not sealed');
  const row = {
    ts: new Date().toISOString(),
    type: entry.type || 'NOTE',
    ...entry,
  };
  appendJsonl(L.biography, row);
  appendJsonl(L.ledgerEvents, { ts: row.ts, type: 'BIOGRAPHY_APPEND', soulId, entryType: row.type });
  return row;
}

function appendLedger(soulId, event) {
  const L = ensureSoulDirs(soulId);
  const row = { ts: new Date().toISOString(), ...event };
  appendJsonl(L.ledgerEvents, row);
  return row;
}

function saveResearch(soulId, name, content) {
  const L = ensureSoulDirs(soulId);
  const safe = String(name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  const file = path.join(L.research, `${Date.now()}-${safe}`);
  if (typeof content === 'string') fs.writeFileSync(file, content);
  else writeJson(file.endsWith('.json') ? file : file + '.json', content);
  appendLedger(soulId, { type: 'RESEARCH_WRITE', file: path.basename(file) });
  return file;
}

function saveArtifact(soulId, name, content) {
  const L = ensureSoulDirs(soulId);
  const safe = String(name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  const file = path.join(L.artifacts, `${Date.now()}-${safe}`);
  if (typeof content === 'string') fs.writeFileSync(file, content);
  else writeJson(file.endsWith('.json') ? file : file + '.json', content);
  appendLedger(soulId, { type: 'ARTIFACT_WRITE', file: path.basename(file) });
  return file;
}

function loadAutonomy(soulId) {
  const L = layout(soulId);
  return readJson(L.autonomy, { ticks: 0, lastTick: null, status: 'idle' });
}

function saveAutonomy(soulId, state) {
  const L = ensureSoulDirs(soulId);
  writeJson(L.autonomy, state);
}

function queueStim(soulId, stim) {
  const L = ensureSoulDirs(soulId);
  const file = path.join(L.stim, `${Date.now()}.json`);
  writeJson(file, { ts: new Date().toISOString(), ...stim });
  appendLedger(soulId, { type: 'STIM_QUEUED', file: path.basename(file) });
  return file;
}

function consumeStim(soulId) {
  const L = ensureSoulDirs(soulId);
  if (!fs.existsSync(L.stim)) return [];
  const files = fs.readdirSync(L.stim).filter((f) => f.endsWith('.json')).sort();
  const out = [];
  for (const f of files) {
    const full = path.join(L.stim, f);
    out.push(readJson(full));
    fs.unlinkSync(full);
  }
  return out;
}

module.exports = {
  PATHS,
  soulDir,
  layout,
  ensureSoulDirs,
  loadSoul,
  listSouls,
  appendBiography,
  appendLedger,
  saveResearch,
  saveArtifact,
  loadAutonomy,
  saveAutonomy,
  queueStim,
  consumeStim,
  readJson,
  writeJson,
};
