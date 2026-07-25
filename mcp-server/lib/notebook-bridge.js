'use strict';
/**
 * Notebook / Drive synchronization layer for shawnru391@gmail.com
 * Uses local FS staging + connected Google Drive tools when available.
 */
const fs = require('fs');
const path = require('path');

const ACCOUNT = process.env.NOTEBOOK_ACCOUNT || 'shawnru391@gmail.com';
const SYNC_DIR = path.join(__dirname, '..', '..', 'memory', 'notebook-sync');

function ensureSyncDir() {
  if (!fs.existsSync(SYNC_DIR)) {
    fs.mkdirSync(SYNC_DIR, { recursive: true });
  }
}

function stageForNotebook(payload) {
  ensureSyncDir();
  const fname = `out_${Date.now()}.json`;
  const full = path.join(SYNC_DIR, fname);
  const record = {
    account: ACCOUNT,
    direction: 'to_notebook',
    ...payload,
    stagedAt: new Date().toISOString()
  };
  fs.writeFileSync(full, JSON.stringify(record, null, 2));
  return { path: full, record };
}

function pullFromNotebook() {
  ensureSyncDir();
  const inbound = [];
  const files = fs.readdirSync(SYNC_DIR).filter(f => f.startsWith('in_') && f.endsWith('.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SYNC_DIR, f), 'utf8'));
      inbound.push(data);
      fs.renameSync(path.join(SYNC_DIR, f), path.join(SYNC_DIR, `processed_${f}`));
    } catch (e) {
      console.error('[notebook-bridge] parse fail', f, e.message);
    }
  }
  return inbound;
}

function injectFromNotebook(message) {
  ensureSyncDir();
  const fname = `in_${Date.now()}.json`;
  const full = path.join(SYNC_DIR, fname);
  const record = {
    account: ACCOUNT,
    direction: 'from_notebook',
    message,
    injectedAt: new Date().toISOString()
  };
  fs.writeFileSync(full, JSON.stringify(record, null, 2));
  return record;
}

module.exports = {
  ACCOUNT,
  stageForNotebook,
  pullFromNotebook,
  injectFromNotebook,
  SYNC_DIR
};
