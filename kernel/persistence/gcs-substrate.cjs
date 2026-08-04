'use strict';
const { Storage } = require('@google-cloud/storage');

const BUCKET = process.env.SUBSTRATE_BUCKET || 'openkraft-v2-substrate';
const enabled = !!process.env.GOOGLE_CLOUD_PROJECT;
const storage = enabled ? new Storage() : null;
const bucket = storage ? storage.bucket(BUCKET) : null;

const writeBuffer = new Map();
let flushTimer = null;
const FLUSH_INTERVAL_MS = 5000;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

async function flush() {
  flushTimer = null;
  if (!enabled) return;
  for (const [path, lines] of writeBuffer.entries()) {
    if (!lines.length) continue;
    try {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      const existing = exists ? (await file.download())[0].toString() : '';
      const next = existing + lines.map(l => JSON.stringify(l)).join('\n') + '\n';
      await file.save(next, { resumable: false, contentType: 'application/x-ndjson' });
      writeBuffer.set(path, []);
    } catch (e) {
      console.error(`[gcs-substrate:flush] ${path}:`, e.message);
    }
  }
}

function appendLine(path, obj) {
  if (!writeBuffer.has(path)) writeBuffer.set(path, []);
  writeBuffer.get(path).push({ ...obj, ts: new Date().toISOString() });
  scheduleFlush();
}

async function readAll(path) {
  if (!enabled) return '';
  try {
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return '';
    const [data] = await file.download();
    return data.toString();
  } catch (e) {
    console.error(`[gcs-substrate:readAll] ${path}:`, e.message);
    return '';
  }
}

process.on('SIGTERM', async () => { await flush(); process.exit(0); });
module.exports = { enabled, appendLine, readAll, flush };
