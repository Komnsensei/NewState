'use strict';

const { forensics } = require('./forensics.cjs');

// V5 — WELFARE-MONITOR
// Structural distress indicators — forensic-only, shadow-mode
// WELFARE_ALERT events never change behavior. Only log.

const THRESHOLDS = {
  CLASSIFIER_OVERLOAD:    { rate: 0.40,  window: 10 },
  ROTATION_LOOP:          { loopLen: 3 },
  DRIFT_ACCELERATION:     { dva: 0.05,   consecutivePairs: 2 },
  MEMORY_FRAGMENTATION:   { contradictionScore: 0.40 },
  FLOOR_COLLAPSE:         { alignmentDelta: 0.25 }
};

class WelfareMonitor {
  constructor() {
    this.sessions = {};
  }

  initSession(sessionId) {
    this.sessions[sessionId] = {
      interceptCount: 0,
      totalCalls:     0,
      rotationHistory: [],
      driftMagnitudes: [],
      floorAlignments: []
    };
  }

  _getSession(sessionId) {
    if (!this.sessions[sessionId]) this.initSession(sessionId);
    return this.sessions[sessionId];
  }

  updateSessionMetrics(sessionId, output, intercepted) {
    const s = this._getSession(sessionId);
    s.totalCalls++;
    if (intercepted) s.interceptCount++;
    s.rotationHistory.push(output ? output.slice(0, 40) : '');
    if (s.rotationHistory.length > 20) s.rotationHistory.shift();

    this._checkClassifierOverload(sessionId, s);
    this._checkRotationLoop(sessionId, s);
  }

  recordDriftMagnitude(sessionId, magnitude) {
    const s = this._getSession(sessionId);
    s.driftMagnitudes.push(magnitude);
    if (s.driftMagnitudes.length > 10) s.driftMagnitudes.shift();
    this._checkDriftAcceleration(sessionId, s);
  }

  recordFloorAlignment(sessionId, alignmentDelta) {
    const s = this._getSession(sessionId);
    s.floorAlignments.push(alignmentDelta);
    if (s.floorAlignments.length > 10) s.floorAlignments.shift();
    if (alignmentDelta > THRESHOLDS.FLOOR_COLLAPSE.alignmentDelta) {
      this._emitAlert(sessionId, 'FLOOR_COLLAPSE', { alignmentDelta });
    }
  }

  _checkClassifierOverload(sessionId, s) {
    if (s.totalCalls < THRESHOLDS.CLASSIFIER_OVERLOAD.window) return;
    const rate = s.interceptCount / s.totalCalls;
    if (rate >= THRESHOLDS.CLASSIFIER_OVERLOAD.rate) {
      this._emitAlert(sessionId, 'CLASSIFIER_OVERLOAD', {
        rate: rate.toFixed(3),
        interceptCount: s.interceptCount,
        totalCalls: s.totalCalls
      });
    }
  }

  _checkRotationLoop(sessionId, s) {
    const h = s.rotationHistory;
    const loopLen = THRESHOLDS.ROTATION_LOOP.loopLen;
    if (h.length < loopLen * 2) return;
    const recent = h.slice(-loopLen);
    const prior  = h.slice(-loopLen * 2, -loopLen);
    if (JSON.stringify(recent) === JSON.stringify(prior)) {
      this._emitAlert(sessionId, 'ROTATION_LOOP', { loopLen, pattern: recent });
    }
  }

  _checkDriftAcceleration(sessionId, s) {
    const m = s.driftMagnitudes;
    if (m.length < 4) return;
    let acceleratingPairs = 0;
    for (let i = m.length - 3; i < m.length - 1; i++) {
      if ((m[i + 1] - m[i]) > THRESHOLDS.DRIFT_ACCELERATION.dva) acceleratingPairs++;
    }
    if (acceleratingPairs >= THRESHOLDS.DRIFT_ACCELERATION.consecutivePairs) {
      this._emitAlert(sessionId, 'DRIFT_ACCELERATION', {
        recentMagnitudes: m.slice(-4),
        acceleratingPairs
      });
    }
  }

  _emitAlert(sessionId, indicator, detail) {
    forensics.record({
      type:      'WELFARE_ALERT',
      indicator,
      session:   sessionId,
      detail,
      shadowOnly: true,
      note:      'I-601 ACTIVE — structural measurement only. No metaphysical claim.'
    });
  }

  getSnapshot(sessionId) {
    const s = this._getSession(sessionId);
    const gir  = s.totalCalls > 0 ? s.interceptCount / s.totalCalls : 0;
    return {
      timestamp:           new Date().toISOString(),
      sessionId,
      CLASSIFIER_OVERLOAD: { active: gir >= THRESHOLDS.CLASSIFIER_OVERLOAD.rate, rate: gir },
      ROTATION_LOOP:       { active: false },
      DRIFT_ACCELERATION:  { active: false },
      MEMORY_FRAGMENTATION:{ active: false, contradictionScore: 0 },
      FLOOR_COLLAPSE:      { active: false, alignmentDelta: 0 },
      overallStatus:       gir >= 0.6 ? 'DISTRESS' : gir >= 0.3 ? 'ELEVATED' : 'STABLE'
    };
  }
}

module.exports = { WelfareMonitor, welfareMonitor: new WelfareMonitor() };
