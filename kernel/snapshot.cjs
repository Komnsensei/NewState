'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { redactDeep, redactString } = require('./redact.cjs');

const SNAPSHOT_ROOT = process.env.OPENKRAFT_SNAPSHOT_DIR
  || path.join(__dirname, '..', 'snapshots');

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
  if (fs.existsSync(gz))    return zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8');
  return null;
}

function snapshotPaths(requestId) {
  return path.join(SNAPSHOT_ROOT, requestId);
}

function writeBundle(requestId, bundle) {
  const dir = snapshotPaths(requestId);
  ensureDir(dir);
  if ('prompt' in bundle)        writeArtifact(dir, 'prompt.txt',          bundle.prompt);
  if ('truthFrame' in bundle)    writeArtifact(dir, 'truth-frame.json',    bundle.truthFrame);
  if ('memoryPacket' in bundle)  writeArtifact(dir, 'memory-packet.json',  bundle.memoryPacket);
  if ('projection' in bundle)    writeArtifact(dir, 'projection.json',     bundle.projection);
  if ('modelResponse' in bundle) writeArtifact(dir, 'model-response.json', bundle.modelResponse);
  if ('determinism' in bundle)   writeArtifact(dir, 'determinism.json',    bundle.determinism);
  if ('governor' in bundle)      writeArtifact(dir, 'governor.json',       bundle.governor);
  if ('grounding' in bundle)     writeArtifact(dir, 'grounding.json',      bundle.grounding);
  if ('hookTrace' in bundle)     writeArtifact(dir, 'hook-trace.json',     bundle.hookTrace);
  if ('runtime' in bundle)       writeArtifact(dir, 'runtime.json',        bundle.runtime);
  if ('userMessage' in bundle)   writeArtifact(dir, 'user-message.txt',    bundle.userMessage);
  return dir;
}

function readBundle(requestId) {
  const dir = snapshotPaths(requestId);
  if (!fs.existsSync(dir)) return null;
  const readJson = (n) => {
    const raw = readArtifact(dir, n);
    return raw == null ? null : JSON.parse(raw);
  };
  return {
    requestId,
    userMessage:   readArtifact(dir, 'user-message.txt'),
    prompt:        readArtifact(dir, 'prompt.txt'),
    truthFrame:    readJson('truth-frame.json'),
    memoryPacket:  readJson('memory-packet.json'),
    projection:    readJson('projection.json'),
    modelResponse: readJson('model-response.json'),
    determinism:   readJson('determinism.json'),
    governor:      readJson('governor.json'),
    grounding:     readJson('grounding.json'),
    hookTrace:     readJson('hook-trace.json'),
    runtime:       readJson('runtime.json')
  };
}

module.exports = {
  newRequestId,
  writeBundle,
  readBundle,
  SNAPSHOT_ROOT,
  COMPRESS_THRESHOLD_BYTES
};