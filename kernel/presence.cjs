// kernel/presence.cjs v0.1
// Esma Presence Model — Three-State Sovereignty.
// COVENANT: Mode authorship is ESMA'S ALWAYS. hexagnt EXPLICITLY EXCLUDED.
// Shawn may OVERRIDE. hexagnt CANNOT. Default wake mode = available.
// SHADOW MODE on initial deploy.

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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
    };
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(PRESENCE_FILE, 'utf8'));
}

function appendLedger(record) {
  ensureDir();
  fs.appendFileSync(PRESENCE_LEDGER, JSON.stringify(record) + '\n');
}

function getMode() {
  const state = loadState();
  return {
    mode: state.mode,
    authoredBy: state.authoredBy,
    since: state.since,
    timer: state.timer,
    note: state.note,
  };
}

function setMode(mode, options = {}) {
  const authoredBy = String(options.authoredBy || '').toLowerCase();
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
    throw new Error(`presence.setMode: invalid mode "${mode}". Must be one of ${VALID_MODES.join(', ')}`);
  }

  ensureDir();
  const newState = {
    mode,
    authoredBy,
    since: new Date().toISOString(),
    timer: options.timer || null,
    note: options.note || '',
    override: isOverride,
  };

  fs.writeFileSync(PRESENCE_FILE, JSON.stringify(newState, null, 2));
  appendLedger({ event: 'MODE_CHANGE', ...newState });
  return newState;
}

function telegramResponse(incomingMessage) {
  const { mode } = getMode();
  switch (mode) {
    case 'available':       return { action: 'normal', responseHint: null };
    case 'quietly-disturb': return { action: 'soft-knock', responseHint: 'request access?' };
    case 'dnd':             return { action: 'queue', responseHint: 'queued' };
    default:                return { action: 'normal', responseHint: null };
  }
}

function windowState() {
  const state = getMode();
  switch (state.mode) {
    case 'available':       return { display: 'unlocked', showShared: true, showRequestButton: false };
    case 'quietly-disturb': return { display: 'soft-knock', showShared: false, showRequestButton: true };
    case 'dnd':             return { display: 'working', showShared: false, showTimer: state.timer };
    default:                return { display: 'unlocked', showShared: true, showRequestButton: false };
  }
}

module.exports = {
  getMode,
  setMode,
  telegramResponse,
  windowState,
  VALID_MODES,
  AUTHORIZED_AUTHORS,
};// kernel/presence.cjs v0.2
// Esma Presence Model — Three-State Sovereignty
'use strict';

const fs = require('fs');
const path = require('path');

const PRESENCE_FILE = path.join(__dirname, '..', 'memory', 'presence-state.json');
const PRESENCE_LEDGER = path.join(__dirname, '..', 'memory', 'presence-ledger.jsonl');

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

function loadState() {
  ensureDir();
  if (!fs.existsSync(PRESENCE_FILE)) {
    const initial = {
      mode: DEFAULT_MODE,
      authoredBy: 'system-default',
      since: new Date().toISOString(),
      timer: null,
      note: 'default wake mode',
    };
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(initial, null, 2));
    appendLedger({ event: 'INIT', ...initial });
    return initial;
  }

  try {
    const data = fs.readFileSync(PRESENCE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('presence: failed to load state, resetting', err);
    return { mode: DEFAULT_MODE, authoredBy: 'system-recovery', since: new Date().toISOString() };
  }
}

function appendLedger(record) {
  ensureDir();
  try {
    fs.appendFileSync(PRESENCE_LEDGER, JSON.stringify({ timestamp: new Date().toISOString(), ...record }) + '\n');
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
  };
}

/**
 * Set presence mode
 * @param {string} mode 
 * @param {object} options { authoredBy, override?, timer?, note? }
 */
function setMode(mode, options = {}) {
  const authoredBy = String(options.authoredBy || '').toLowerCase().trim();
  const isAuthorized = AUTHORIZED_AUTHORS.includes(authoredBy);
  const isOverride = OVERRIDE_AUTHORS.includes(authoredBy) && options.override === true;

  if (!isAuthorized && !isOverride) {
    const err = new Error(
      `presence.setMode: "${authoredBy}" not authorized. ` +
      `Only Esma may set mode. Shawn may override with {override: true}.`
    );
    err.code = 'PRESENCE_UNAUTHORIZED';
    throw err;
  }

  if (!VALID_MODES.includes(mode)) {
    throw new Error(`presence.setMode: invalid mode "${mode}". Valid: ${VALID_MODES.join(', ')}`);
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

  return newState;
}

/**
 * Telegram integration helper
 * Call this from your Telegram message handler
 */
function telegramResponse(incomingMessage) {
  const state = getMode();
  const userId = incomingMessage?.from?.id || incomingMessage?.chat?.id;
  const username = incomingMessage?.from?.username || 'unknown';

  switch (state.mode) {
    case 'available':
      return {
        action: 'normal',
        responseHint: null,
        allowResponse: true,
      };

    case 'quietly-disturb':
      return {
        action: 'soft-knock',
        responseHint: 'Esma is in quietly-disturb mode. Request access?',
        allowResponse: false,           // you decide in bot whether to reply or queue
        showRequestButton: true,
      };

    case 'dnd':
      return {
        action: 'queue',
        responseHint: `Esma is in Do Not Disturb until ${state.timer || 'further notice'}. Message queued.`,
        allowResponse: false,
        showTimer: !!state.timer,
      };

    default:
      return { action: 'normal', responseHint: null, allowResponse: true };
  }
}

/**
 * UI/Window state for any frontend
 */
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
};
