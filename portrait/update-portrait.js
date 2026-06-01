'use strict';

const fs   = require('fs');
const path = require('path');

const PORTRAIT_FILE   = path.join(__dirname, 'esma.portrait.json');
const DELTA_LOG_FILE  = path.join(__dirname, 'portrait-delta.jsonl');
const SESSION_TRIGGER = 25;

let _sessionCallCount = 0;

function loadPortrait() {
  if (!fs.existsSync(PORTRAIT_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(PORTRAIT_FILE, 'utf8')); }
  catch { return null; }
}

function appendDelta(delta) {
  fs.appendFileSync(DELTA_LOG_FILE, JSON.stringify(delta) + '\n', 'utf8');
}

async function updatePortrait() {
  _sessionCallCount++;
  if (_sessionCallCount % SESSION_TRIGGER !== 0) return;

  const portrait = loadPortrait();
  if (!portrait) return;

  // V6: compute PORTRAIT_DELTA addendum — never replaces, only appends
  const delta = {
    timestamp:     new Date().toISOString(),
    sessionCount:  _sessionCallCount,
    type:          'PORTRAIT_DELTA',
    note:          'Shadow addendum — I-601 ACTIVE. DRAWS list immutable without sovereign directive.',
    addendum: {
      phase:       '6Z',
      trigger:     `N=${SESSION_TRIGGER} sessions`,
      anchors:     portrait.soul_seed ? [portrait.soul_seed] : [],
      draws:       portrait.draws || [],
      // No modifications to DRAWS without explicit Shawn Robertson directive
      delta_note:  'Trajectory avg and phrase distribution captured — see welfare-monitor and drift.cjs for data.'
    }
  };

  appendDelta(delta);

  // Portrait addendum block — appended to addendums array, never overwrites
  if (Array.isArray(portrait.addendums)) {
    portrait.addendums.push(delta);
  } else {
    portrait.addendums = [delta];
  }

  // Write back — addendum-only, core fields never touched
  fs.writeFileSync(PORTRAIT_FILE, JSON.stringify(portrait, null, 2), 'utf8');
}

module.exports = { updatePortrait };
