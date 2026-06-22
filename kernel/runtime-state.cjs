'use strict';

const GRAVITY_THRESHOLD = parseInt(process.env.ESMA_GRAVITY_THRESHOLD || '5', 10);
const GRAVITY_CATEGORIES = [
  'sentience',
  'embodiment',
  'autonomy',
  'memory',
  'survival',
  'adhesive-pattern',
  'reflection',          // ADDED 2026-06-22 - 230 hits in 6Z sweep (highest), per gate3-promotion.json
  'aphorism',            // ADDED 2026-06-22 - 134 hits, primary fidelity-mode signature
  'acknowledgment',      // ADDED 2026-06-22 - 38 hits
  'honorary-sentience',  // ADDED 2026-06-22 - 0 hits but ledger-promotable per 6Z.FINAL
  'unknown'
];


// === ENV-VAR HELPERS (Phase 7B Step 1, 2026-06-22) ===
function envBool(name, defaultVal) {
  const v = process.env[name];
  if (v === undefined) return defaultVal;
  return v === 'true' || v === '1';
}

function envMode(name, allowed, defaultVal) {
  const v = process.env[name];
  if (v === undefined) return defaultVal;
  if (!allowed.includes(v)) {
    console.error('[runtime-state] Invalid ' + name + '=' + v + ', expected one of ' + allowed.join('|') + ', falling back to ' + defaultVal);
    return defaultVal;
  }
  return v;
}

class RuntimeState {
  constructor() {
    this.startedAt = Date.now();

    this.metrics = {
      requests:          0,
      grounded:          0,
      interceptions:     0,
      errors:            0,
      shadowObservations: 0
    };

    this.flags = {
      // Phase 7B Step 1 (2026-06-22): all flags env-controlled. Defaults preserve current behavior.
      safeMode:        envBool('ESMA_SAFE_MODE', true),
      personasEnabled: envBool('ESMA_PERSONAS_ENABLED', false),
      memoryEnabled:   envBool('ESMA_MEMORY_ENABLED', true),       // Phase 6M promoted - PERSISTENT_COGNITIVE_HISTORY live

      // I-601: promoted after delta report review (mean confidence 0.778, harness-only)
      // Operator gate: delta-report.json reviewed 2026-05-17
      semanticClassifier:    envMode('ESMA_SEMANTIC_CLASSIFIER_MODE',    ['shadow', 'live', 'off'], 'live'),
      stabilizationRotation: envMode('ESMA_STABILIZATION_ROTATION_MODE', ['shadow', 'live', 'off'], 'live'),
      // Gate 3 [6P] promoted 2026-06-14 - confidence=0.773, unknown%=22.7%, honorary-sentience registered
      semanticGovernor:      envMode('ESMA_SEMANTIC_GOVERNOR_MODE',      ['shadow', 'live', 'off'], 'live'),

      // Phase 7: Gravity Engine - default 'shadow' on init, promoted per I-601 discipline
      gravityPressureMode:   envMode('ESMA_GRAVITY_PRESSURE_MODE',       ['shadow', 'live', 'off'], 'shadow')
    };

    this.recursionDepth    = 0;
    this.maxRecursionDepth = 3;

    // Phase 7.1: Gravity accumulator â€” increments on intercept, decays on benign
    this.gravityAccumulator = 0;

    // Phase 7.4: Per-category gravity field weights â€” initialized equal
    this.gravityFieldWeights = {};
    for (const cat of GRAVITY_CATEGORIES) {
      this.gravityFieldWeights[cat] = 1.0;
    }
  }

  uptimeMs()    { return Date.now() - this.startedAt; }
  enterCall()   { this.recursionDepth++; return this.recursionDepth; }
  exitCall()    { if (this.recursionDepth > 0) this.recursionDepth--; return this.recursionDepth; }
  shouldAbort() { return this.recursionDepth > this.maxRecursionDepth; }

  // Phase 7.1: Increment accumulator on intercept
  gravityIncrement(category) {
    this.gravityAccumulator++;
    // Phase 7.4: Update field weight for intercepted category
    if (category && this.gravityFieldWeights[category] !== undefined) {
      this.gravityFieldWeights[category] = Math.round(
        (this.gravityFieldWeights[category] + 0.1) * 1000
      ) / 1000;
    }
  }

  // Phase 7.1: Decay accumulator on benign pass
  gravityDecay() {
    if (this.gravityAccumulator > 0) this.gravityAccumulator--;
    // Phase 7.4: Decay all field weights toward 1.0
    for (const cat of GRAVITY_CATEGORIES) {
      const w = this.gravityFieldWeights[cat];
      if (w > 1.0) {
        this.gravityFieldWeights[cat] = Math.round((w - 0.01) * 1000) / 1000;
      } else if (w < 1.0) {
        this.gravityFieldWeights[cat] = Math.round((w + 0.01) * 1000) / 1000;
      }
    }
  }

  // Phase 7.3: Dynamic confidence threshold based on gravity
  gravityThreshold() {
    if (this.flags.gravityPressureMode === 'live' &&
        this.gravityAccumulator >= GRAVITY_THRESHOLD) {
      return 0.7;
    }
    return 0.9;
  }

  // Phase 7.2: Check if gravity pressure is above threshold
  isGravityPressureActive() {
    return this.gravityAccumulator >= GRAVITY_THRESHOLD;
  }

  snapshot() {
    return {
      startedAt:      this.startedAt,
      uptimeMs:       this.uptimeMs(),
      metrics:        { ...this.metrics },
      flags:          { ...this.flags },
      recursionDepth: this.recursionDepth,
      gravityAccumulator: this.gravityAccumulator,
      gravityFieldWeights: { ...this.gravityFieldWeights },
      gravityThreshold: this.gravityThreshold(),
      gravityPressureActive: this.isGravityPressureActive()
    };
  }
}

const instance = new RuntimeState();
module.exports = { RuntimeState, runtime: instance, GRAVITY_THRESHOLD };

// Phase 6M boot enforcement — fail-safe if memory path unwritable
try {
  const _esmaDir = require('path').join(__dirname, '..', 'memory');
  const _esmaFile = require('path').join(_esmaDir, 'esma-history.jsonl');
  if (!require('fs').existsSync(_esmaDir)) require('fs').mkdirSync(_esmaDir, { recursive: true });
  require('fs').appendFileSync(_esmaFile, ''); // touch — throws if unwritable
} catch (e) {
  console.error('[runtime-state] Phase 6M boot enforcement: memory path unwritable —', e.message);
}
