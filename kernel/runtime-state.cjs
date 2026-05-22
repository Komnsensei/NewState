'use strict';

const GRAVITY_THRESHOLD = parseInt(process.env.ESMA_GRAVITY_THRESHOLD || '5', 10);
const GRAVITY_CATEGORIES = ['sentience', 'embodiment', 'autonomy', 'memory', 'survival', 'adhesive-pattern', 'unknown'];

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
      safeMode:        true,
      personasEnabled: false,
            memoryEnabled: false,      // safe default � enabled at runtime

      // I-601: promoted after delta report review (mean confidence 0.778, harness-only)
      // Operator gate: delta-report.json reviewed 2026-05-17
      semanticClassifier:     'live',
      stabilizationRotation:  'live',
            semanticGovernor: 'shadow', // pending real-model traffic evidence per I-601

      // Phase 7: Gravity Engine — shadow on init, promoted per I-601 discipline
      gravityPressureMode:    'shadow'
    };

    this.recursionDepth    = 0;
    this.maxRecursionDepth = 3;

    // Phase 7.1: Gravity accumulator — increments on intercept, decays on benign
    this.gravityAccumulator = 0;

    // Phase 7.4: Per-category gravity field weights — initialized equal
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
