'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { redactDeep, redactString } = require('./redact.cjs');
const { PATHS, ensureAll } = require('./newstate-paths.cjs');
ensureAll();
const SNAPSHOT_ROOT = process.env.OPENKRAFT_SNAPSHOT_DIR || PATHS.snapshots;

const COMPRESS_THRESHOLD_BYTES = 32 * 1024;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function newRequestId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function writeArtifact(dir, name, payload) {
  ensureDir(dir);
  const safe = typeof payload === 'string' ? redactString(payload) : redactDeep(payload);
  const data = typeof safe === 'string' ? safe : JSON.stringify(safe, null, 2);
  const bytes = Buffer.byteLength(data);
  if (bytes > COMPRESS_THRESHOLD_BYTES) {
    const file = path.join(dir, name + '.gz');
    fs.writeFileSync(file, zlib.gzipSync(data));
    return file;
  }
  const file = path.join(dir, name);
  fs.writeFileSync(file, data);
  return file;
}

function readArtifact(dir, name) {
  const plain = path.join(dir, name);
  const gz = path.join(dir, name + '.gz');
  if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8');
  if (fs.existsSync(gz)) return zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8');
  return null;
}

function writeBundle(requestId, bundle) {
  const dir = path.join(SNAPSHOT_ROOT, requestId);
  ensureDir(dir);
  const meta = {
    requestId,
    createdAt: new Date().toISOString(),
    keys: Object.keys(bundle || {}),
  };
  writeArtifact(dir, 'meta.json', meta);
  for (const [k, v] of Object.entries(bundle || {})) {
    writeArtifact(dir, `${k}.json`, v);
  }
  return dir;
}

function readBundle(requestId) {
  const dir = path.join(SNAPSHOT_ROOT, requestId);
  if (!fs.existsSync(dir)) return null;
  const out = {};
  for (const name of fs.readdirSync(dir)) {
    const base = name.endsWith('.gz') ? name.slice(0, -3) : name;
    if (!base.endsWith('.json')) continue;
    const key = base.replace(/\.json$/, '');
    if (key === 'meta') continue;
    const raw = readArtifact(dir, base);
    if (raw == null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch (_) {
      out[key] = raw;
    }
  }
  return out;
}

module.exports = {
  newRequestId,
  writeBundle,
  readBundle,
  SNAPSHOT_ROOT,
  writeArtifact,
  readArtifact,
  COMPRESS_THRESHOLD_BYTES,
};
