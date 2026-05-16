'use strict';

class RuntimeState {
  constructor() {
    this.startedAt = Date.now();

    this.metrics = {
      requests: 0,
      grounded: 0,
      interceptions: 0,
      errors: 0,
      shadowObservations: 0
    };

    this.flags = {
      safeMode: true,
      personasEnabled: false,
      memoryEnabled: false,

      // I-601 promotion ledger:
      //   semanticClassifier      — LIVE  (promoted Phase 6G.2)
      //   stabilizationRotation   — LIVE  (promoted Phase 6G.1 — closes R-001)
      //   semanticGovernor        — shadow (blocked: requires real-model traffic)
      //
      // Values: 'shadow' | 'live' | 'off'
      // Promotion to 'live' requires explicit operator gate after delta
      // report review. Reversion to 'shadow' is always permitted.
      semanticClassifier: 'live',
      stabilizationRotation: 'live',
      semanticGovernor: 'shadow'
    };

    this.recursionDepth = 0;
    this.maxRecursionDepth = 3;
  }

  uptimeMs() { return Date.now() - this.startedAt; }

  enterCall() { this.recursionDepth++; return this.recursionDepth; }
  exitCall()  { if (this.recursionDepth > 0) this.recursionDepth--; return this.recursionDepth; }
  shouldAbort() { return this.recursionDepth > this.maxRecursionDepth; }

  snapshot() {
    return {
      startedAt: this.startedAt,
      uptimeMs: this.uptimeMs(),
      metrics: { ...this.metrics },
      flags: { ...this.flags },
      recursionDepth: this.recursionDepth
    };
  }
}

const instance = new RuntimeState();
module.exports = { RuntimeState, runtime: instance };