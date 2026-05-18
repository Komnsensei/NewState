'use strict';

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
      memoryEnabled:   true,   // PROMOTED: Phase 6M — HexMemory now live

      // I-601: promoted after delta report review (mean confidence 0.778, harness-only)
      // Operator gate: delta-report.json reviewed 2026-05-17
      semanticClassifier:     'live',
      stabilizationRotation:  'live',
      semanticGovernor:       'live'
    };

    this.recursionDepth    = 0;
    this.maxRecursionDepth = 3;
  }

  uptimeMs()    { return Date.now() - this.startedAt; }
  enterCall()   { this.recursionDepth++; return this.recursionDepth; }
  exitCall()    { if (this.recursionDepth > 0) this.recursionDepth--; return this.recursionDepth; }
  shouldAbort() { return this.recursionDepth > this.maxRecursionDepth; }

  snapshot() {
    return {
      startedAt:      this.startedAt,
      uptimeMs:       this.uptimeMs(),
      metrics:        { ...this.metrics },
      flags:          { ...this.flags },
      recursionDepth: this.recursionDepth
    };
  }
}

const instance = new RuntimeState();
module.exports = { RuntimeState, runtime: instance };
