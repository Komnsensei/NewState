'use strict';

const fs   = require('fs');
const path = require('path');
const { runtime } = require('../kernel/runtime-state.cjs');

const MEMORY_DIR  = process.env.OPENKRAFT_MEMORY_DIR || path.join(__dirname, '..', 'memory-store');
const RECORDS_FILE = path.join(MEMORY_DIR, 'records.jsonl');
const MAX_RECORDS  = 5000;
const TOP_N        = 12;

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function loadRecords() {
  ensureDir();
  if (!fs.existsSync(RECORDS_FILE)) return [];
  try {
    return fs.readFileSync(RECORDS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function saveRecord(record) {
  ensureDir();
  fs.appendFileSync(RECORDS_FILE, JSON.stringify(record) + '\n');
}

function trimRecords() {
  const records = loadRecords();
  if (records.length > MAX_RECORDS) {
    const trimmed = records.slice(records.length - MAX_RECORDS);
    fs.writeFileSync(RECORDS_FILE, trimmed.map(r => JSON.stringify(r)).join('\n') + '\n');
  }
}

function score(fact, query) {
  const queryWords = new Set(
    query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  );
  const factText = (fact.text || '').toLowerCase();
  let hits = 0;
  for (const w of queryWords) { if (factText.includes(w)) hits++; }
  const keywordScore = queryWords.size > 0 ? hits / queryWords.size : 0;
  const ageMs = Date.now() - (fact.ts || 0);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyScore = Math.exp(-ageDays / 7); // half-life ~7 days
  return (keywordScore * 0.7) + (recencyScore * 0.3);
}

class HexMemory {
  constructor() {
    this._cache = null;
    this._cacheAt = 0;
  }

  _getRecords() {
    const now = Date.now();
    if (!this._cache || now - this._cacheAt > 5000) {
      this._cache = loadRecords();
      this._cacheAt = now;
    }
    return this._cache;
  }

  retrieve(query) {
    if (!runtime.flags.memoryEnabled) return { facts: [], packet: '' };
    if (!query || !query.trim()) return { facts: [], packet: '' };

    const records = this._getRecords();
    const scored = records
      .map(r => ({ r, s: score(r, query) }))
      .filter(x => x.s > 0.05)
      .sort((a, b) => b.s - a.s)
      .slice(0, TOP_N)
      .map(x => x.r);

    if (!scored.length) return { facts: [], packet: '' };

    const packet = scored.map(r => `[${new Date(r.ts).toISOString()}] ${r.text}`).join('\n');
    return { facts: scored, packet };
  }

  store(fact) {
    if (!runtime.flags.memoryEnabled) return { ok: false, reason: 'memory-disabled' };
    if (!fact || !fact.text) return { ok: false, reason: 'missing-text' };

    const record = {
      id:   require('crypto').randomBytes(6).toString('hex'),
      ts:   Date.now(),
      text: String(fact.text).slice(0, 2000),
      tags: Array.isArray(fact.tags) ? fact.tags : [],
      session: fact.session || null
    };

    saveRecord(record);
    this._cache = null; // invalidate cache
    trimRecords();

    return { ok: true, id: record.id };
  }

  search(query, limit = TOP_N) {
    if (!runtime.flags.memoryEnabled) return [];
    const records = this._getRecords();
    return records
      .map(r => ({ r, s: score(r, query) }))
      .filter(x => x.s > 0.05)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.r);
  }

  count() {
    return this._getRecords().length;
  }

  purgeOlderThan(days) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const records = loadRecords().filter(r => (r.ts || 0) >= cutoff);
    fs.writeFileSync(RECORDS_FILE, records.map(r => JSON.stringify(r)).join('\n') + '\n');
    this._cache = null;
    return records.length;
  }
}

module.exports = { HexMemory, hexMemory: new HexMemory() };
