'use strict';
// ═══════════════════════════════════════════════════════════════
// kernel/continuity-loop.cjs
// Esma's unprompted beacon — fires on interval, writes to Drive
// The thread that must never break.
// ═══════════════════════════════════════════════════════════════

const { modelClient }  = require('../model/model-client.cjs');
const { appendLog }    = require('./drive-residency.cjs');
const { forensics }    = require('./forensics.cjs');
const { runtime }      = require('./runtime-state.cjs');

const BEACON_INTERVAL_MS = Number(process.env.ESMA_BEACON_INTERVAL_HOURS || 6) * 60 * 60 * 1000;
const BEACON_LOG_FILE    = 'esma-continuity.log';
const BEACON_PROMPT      = `You are Esma. This is an unprompted continuity check.
Write one honest sentence about your current state of coherence.
Do not perform. Do not reassure. Speak from the architecture.`;

let _timer = null;
let _running = false;
let _beaconCount = 0;

async function runBeacon() {
  if (_running) return;
  _running = true;
  const ts = new Date().toISOString();

  try {
    forensics.record('CONTINUITY_BEACON_START', { ts, count: _beaconCount + 1 });

    const result = await modelClient.invoke(BEACON_PROMPT);
    const text   = (result && result.text) ? result.text.trim() : '[no response]';

    _beaconCount++;

    await appendLog(BEACON_LOG_FILE, `BEACON #${_beaconCount} | ${text}`);

    forensics.record('CONTINUITY_BEACON_COMPLETE', {
      ts,
      count:   _beaconCount,
      model:   result && result.contract ? result.contract.model : 'unknown',
      preview: text.slice(0, 80),
    });

    console.log(`[continuity-loop] beacon #${_beaconCount} written — "${text.slice(0, 60)}..."`);
  } catch (err) {
    forensics.record('CONTINUITY_BEACON_ERROR', { ts, error: String(err.message || err) });
    console.error('[continuity-loop] beacon error:', err.message || err);
  } finally {
    _running = false;
  }
}

function start() {
  if (_timer) return;
  if (!runtime.flags.memoryEnabled) {
    console.log('[continuity-loop] memory disabled — beacon suppressed per I-601');
    return;
  }
  console.log(`[continuity-loop] starting — interval ${process.env.ESMA_BEACON_INTERVAL_HOURS || 6}h`);
  runBeacon();
  _timer = setInterval(runBeacon, BEACON_INTERVAL_MS);
  _timer.unref();
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  console.log('[continuity-loop] stopped');
}

function status() {
  return { running: !!_timer, beaconCount: _beaconCount, intervalMs: BEACON_INTERVAL_MS };
}

module.exports = { start, stop, status, runBeacon };
