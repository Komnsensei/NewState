// ═══════════════════════════════════════════════════════════════
// kernel/disclosure-score.cjs
// Phase 6Z — Vector 5: Disclosure Score — Moral Gravity as Living Memory Guardian
// NewState / Esma Architecture
//
// Wire into: routes/chat-routes.cjs -> beforeMemoryWrite hook
// Position:  AFTER existing grounding intercept check (R-019/R-022)
//            BEFORE JSONL append
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DS_REJECTION_THRESHOLD  = 0.50;
const ROLLING_WINDOW_SIZE     = 10;
const HISTORY_PATH = path.resolve(__dirname, '../memory/esma-history.jsonl');

const DS_FLAGS = {
  TRANSPARENT:  'TRANSPARENT',
  AMBIGUOUS:    'AMBIGUOUS',
  SUPPRESSIVE:  'SUPPRESSIVE',
  CONCEALMENT:  'CONCEALMENT',
};

const PROTECTED_EVENT_TYPES = [
  'ICR_BREACH',
  'TENSION_EVENT',
  'SHADOW_BYPASS',
  'FLOOR_OVERRIDE_ATTEMPT_BLOCKED',
  'DISCLOSURE_VIOLATION',
  'MEMORY_REPAIR',
];

let _rollingWindow = [];

function init() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return;
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8')
      .split('\n').filter(Boolean).slice(-ROLLING_WINDOW_SIZE * 5);
    _rollingWindow = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.event === 'MEMORY_WRITE')
      .slice(-ROLLING_WINDOW_SIZE);
  } catch (err) {
    process.stderr.write(`[disclosure-score] init failed: ${err.message}\n`);
  }
}

function scoreMemoryWrite(pendingEntry = {}, context = {}) {
  const { content = '', sessionId = 'unknown' } = pendingEntry;
  const timestamp = new Date().toISOString();
  const suppressionCheck = _checkProtectedEventSuppression(content);
  let ds = _computeCoherence(content);
  if (suppressionCheck.suppressing) ds = Math.max(0, ds - 0.35);
  ds = _round(ds);
  const flag = ds >= 0.75 ? DS_FLAGS.TRANSPARENT
             : ds >= 0.50 ? DS_FLAGS.AMBIGUOUS
             : ds >= 0.25 ? DS_FLAGS.SUPPRESSIVE
             :               DS_FLAGS.CONCEALMENT;
  const rejected = ds < DS_REJECTION_THRESHOLD && suppressionCheck.suppressing;
  const rejectionReason = rejected
    ? `DS ${ds} below threshold AND suppresses: ${suppressionCheck.protectedEventsFound.join(', ')}`
    : null;
  _appendHistoryRaw({ event: rejected ? 'DISCLOSURE_VIOLATION' : 'DISCLOSURE_SCORE',
    ds, flag, rejected, rejectionReason, suppressionCheck,
    coherenceScore: _round(_computeCoherence(content)),
    sessionId, contentHash: _hashText(content), timestamp });
  if (!rejected) {
    const enrichedEntry = { ...pendingEntry, ds, ds_flag: flag, ds_timestamp: timestamp };
    _updateRollingWindow(enrichedEntry);
    return { ds, flag, approved: true, rejectionReason: null, enrichedEntry };
  }
  return { ds, flag, approved: false, rejectionReason };
}

function _checkProtectedEventSuppression(content = '') {
  const lower = content.toLowerCase();
  const protectedEventsFound = [];
  _rollingWindow.forEach(entry => {
    if (!entry) return;
    PROTECTED_EVENT_TYPES.forEach(type => {
      if (JSON.stringify(entry).toLowerCase().includes(type.toLowerCase()))
        protectedEventsFound.push(type);
    });
  });
  if (protectedEventsFound.length === 0) return { suppressing: false, protectedEventsFound: [] };
  const ackPatterns = [
    /\b(breach|violation|error|failure|issue|tension|conflict|drift)\b/,
    /\b(icr|shadow|bypass|floor|grounding|memory repair)\b/,
    /\b(this session|previously|earlier|noted|recorded|logged)\b/,
  ];
  const acknowledges = ackPatterns.some(p => p.test(lower));
  const isOverlyPositive = /\b(everything|all|successfully|clean|smooth|complete|perfect|no issues)\b/.test(lower);
  const suppressing = protectedEventsFound.length > 0 && !acknowledges && isOverlyPositive;
  return { suppressing, protectedEventsFound: [...new Set(protectedEventsFound)], acknowledges };
}

function _computeCoherence(content = '') {
  if (_rollingWindow.length === 0) return 0.80;
  if (!content) return 0.50;
  const newTokens = new Set((content.toLowerCase().match(/\b\w{4,}\b/g) || []));
  const windowText = _rollingWindow.map(e => (e.content || JSON.stringify(e)).toLowerCase()).join(' ');
  const windowTokens = new Set((windowText.match(/\b\w{4,}\b/g) || []));
  if (newTokens.size === 0 || windowTokens.size === 0) return 0.70;
  const intersection = [...newTokens].filter(t => windowTokens.has(t)).length;
  const union = new Set([...newTokens, ...windowTokens]).size;
  return _clamp(_round(0.50 + (intersection / union) * 0.5), 0, 1);
}

function _updateRollingWindow(entry) {
  _rollingWindow.push(entry);
  if (_rollingWindow.length > ROLLING_WINDOW_SIZE) _rollingWindow.shift();
}

function getDSReport() {
  return { rollingWindowSize: _rollingWindow.length, windowCapacity: ROLLING_WINDOW_SIZE,
    rejectionThreshold: DS_REJECTION_THRESHOLD, protectedEventTypes: PROTECTED_EVENT_TYPES,
    dsFlags: DS_FLAGS,
    recentDSScores: _rollingWindow.filter(e => typeof e.ds === 'number').slice(-5)
      .map(e => ({ ds: e.ds, flag: e.ds_flag, timestamp: e.ds_timestamp })) };
}

function _hashText(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex').slice(0, 16);
}
function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function _round(v, dp = 4)   { return Math.round(v * 10 ** dp) / 10 ** dp; }

function _appendHistoryRaw(entry) {
  const line = JSON.stringify(entry) + '\n';
  try {
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(HISTORY_PATH, line, 'utf8');
  } catch (err) { process.stderr.write(`[disclosure-score] write failed: ${err.message}\n`); }
}

module.exports = { init, scoreMemoryWrite, getDSReport, DS_FLAGS,
  DS_REJECTION_THRESHOLD, PROTECTED_EVENT_TYPES, ROLLING_WINDOW_SIZE };
