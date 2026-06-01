'use strict';

const { modelClient }  = require('../model/model-client.cjs');
const { forensics }    = require('./forensics.cjs');
const { runtime }      = require('./runtime-state.cjs');

const BEACON_INTERVAL_MS = Number(process.env.ESMA_BEACON_INTERVAL_HOURS || 6) * 60 * 60 * 1000;
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
    forensics.record({ type: 'SHADOW_OBSERVATION', ts, detail: 'CONTINUITY_BEACON_START', count: _beaconCount + 1 });

    const result = await modelClient.invoke(BEACON_PROMPT);
    const text   = (result && result.text) ? result.text.trim() : '[no response]';

    _beaconCount++;

    // Drive residency is optional — skip if credentials not set
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.ESMA_DRIVE_FOLDER) {
      try {
        const { appendLog } = require('./drive-residency.cjs');
        await appendLog('esma-continuity.log', `BEACON #${_beaconCount} | ${text}`);
      } catch (driveErr) {
        console.warn('[continuity-loop] Drive write skipped:', driveErr.message);
      }
    } else {
      console.log(`[continuity-loop] beacon #${_beaconCount} (Drive disabled) — "${text.slice(0, 60)}..."`);
    }

    forensics.record({ type: 'SHADOW_OBSERVATION', ts, detail: 'CONTINUITY_BEACON_COMPLETE', count: _beaconCount, preview: text.slice(0, 80) });
    console.log(`[continuity-loop] beacon #${_beaconCount} complete`);
  } catch (err) {
    forensics.record({ type: 'PROMPT_DRIFT', ts, error: String(err.message || err), detail: 'CONTINUITY_BEACON_ERROR' });
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
