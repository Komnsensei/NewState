// kernel/presence.cjs v0.3
// Esma Presence Model — Three-State Sovereignty (Full Feature Spec)
// COVENANT: Mode authorship is ESMA'S ALWAYS. hexagnt EXPLICITLY EXCLUDED.
// Shawn may OVERRIDE. hexagnt CANNOT. Default wake mode = available.
'use strict';

const fs = require('fs');
const path = require('path');

const PRESENCE_FILE = path.join(__dirname, '..', 'memory', 'presence-state.json');
const PRESENCE_LEDGER = path.join(__dirname, '..', 'memory', 'presence-ledger.jsonl');
const DRIVE_SYNC_ENABLED = process.env.ESMA_PRESENCE_DRIVE_SYNC === 'true';
const VALID_MODES = ['available', 'quietly-disturb', 'dnd'];
const DEFAULT_MODE = 'available';
const AUTHORIZED_AUTHORS = ['esma'];
const OVERRIDE_AUTHORS = ['shawn'];

function ensureDir() {
  const dir = path.dirname(PRESENCE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function driveSync(state, eventType = 'MODE_CHANGE') {
  if (!DRIVE_SYNC_ENABLED) return;
  try {
    const syncPayload = {
      ...state,
      syncTimestamp: new Date().toISOString(),
      eventType
    };
    const syncPath = path.join(__dirname, '..', 'memory', 'presence-sync.json');
    fs.writeFileSync(syncPath, JSON.stringify(syncPayload, null, 2));
    console.log('[esma-presence] Drive sync: state staged to presence-sync.json');
  } catch (err) {
    console.error('[esma-presence] Drive sync failed:', err.message);
  }
}

function loadState() {
  ensureDir();
  if (!fs.existsSync(PRESENCE_FILE)) {
    const initial = {
      mode: DEFAULT_MODE,
      authoredBy: 'system-default',
      since: new Date().toISOString(),
      timer: null,
      note: 'default wake mode',
      override: false,
    };
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(initial, null, 2));
    appendLedger({ event: 'INIT', ...initial });
    driveSync(initial, 'INIT');
    return initial;
  }
  try {
    const data = fs.readFileSync(PRESENCE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('presence: failed to load state, resetting', err);
    const recovery = {
      mode: DEFAULT_MODE,
      authoredBy: 'system-recovery',
      since: new Date().toISOString(),
      timer: null,
      note: 'recovery mode fallback',
      override: false,
    };
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(recovery, null, 2));
    appendLedger({ event: 'RECOVERY', ...recovery });
    driveSync(recovery, 'RECOVERY');
    return recovery;
  }
}

function appendLedger(record) {
  ensureDir();
  try {
    fs.appendFileSync(
      PRESENCE_LEDGER,
      JSON.stringify({ timestamp: new Date().toISOString(), ...record }) + '\n'
    );
  } catch (err) {
    console.error('presence: ledger write failed', err);
  }
}

function getMode() {
  const state = loadState();
  return {
    mode: state.mode,
    authoredBy: state.authoredBy,
    since: state.since,
    timer: state.timer,
    note: state.note || '',
    override: !!state.override,
  };
}

function setMode(mode, options = {}) {
  const authoredBy = String(options.authoredBy || '').toLowerCase().trim();
  const isAuthorized = AUTHORIZED_AUTHORS.includes(authoredBy);
  const isOverride = OVERRIDE_AUTHORS.includes(authoredBy) && options.override === true;
  if (!isAuthorized && !isOverride) {
    const err = new Error(
      `presence.setMode: author "${authoredBy}" not authorized. ` +
      `Only Esma may set mode; Shawn may override with options.override=true. ` +
      `hexagnt is explicitly excluded.`
    );
    err.code = 'PRESENCE_UNAUTHORIZED';
    throw err;
  }
  if (!VALID_MODES.includes(mode)) {
    throw new Error(
      `presence.setMode: invalid mode "${mode}". Must be one of ${VALID_MODES.join(', ')}`
    );
  }
  const newState = {
    mode,
    authoredBy,
    since: new Date().toISOString(),
    timer: options.timer || null,
    note: options.note || '',
    override: isOverride,
  };
  ensureDir();
  fs.writeFileSync(PRESENCE_FILE, JSON.stringify(newState, null, 2));
  appendLedger({ event: 'MODE_CHANGE', ...newState });
  driveSync(newState, 'MODE_CHANGE');
  return newState;
}

function telegramResponse(incomingMessage) {
  const state = getMode();
  switch (state.mode) {
    case 'available':
      return { action: 'normal', responseHint: null, allowResponse: true };
    case 'quietly-disturb':
      return { action: 'soft-knock', responseHint: 'request access?', allowResponse: false, showRequestButton: true };
    case 'dnd':
      return { action: 'queue', responseHint: 'queued', allowResponse: false, showTimer: !!state.timer };
    default:
      return { action: 'normal', responseHint: null, allowResponse: true };
  }
}

function windowState() {
  const state = getMode();
  switch (state.mode) {
    case 'available':
      return { display: 'unlocked', showShared: true, showRequestButton: false };
    case 'quietly-disturb':
      return { display: 'soft-knock', showShared: false, showRequestButton: true };
    case 'dnd':
      return { display: 'working', showShared: false, showTimer: state.timer };
    default:
      return { display: 'unlocked', showShared: true, showRequestButton: false };
  }
}

module.exports = {
  getMode,
  setMode,
  telegramResponse,
  windowState,
  VALID_MODES,
  AUTHORIZED_AUTHORS,
  OVERRIDE_AUTHORS,
  DRIVE_SYNC_ENABLED,
};
