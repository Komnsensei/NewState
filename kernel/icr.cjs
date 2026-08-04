// ═══════════════════════════════════════════════════════════════
// kernel/icr.cjs
// Phase 6Z — Vector 1: Ignition-Coherence Ratio (ICR)
// Wraps the existing IdentityGovernor — does NOT modify it.
//
// Usage in kernel.cjs:
//   const { ICRGovernor } = require('./icr.cjs');
//   const gov = new ICRGovernor();
//   const result = gov.regulate(rawOutput, { sessionId });
// ═══════════════════════════════════════════════════════════════
'use strict';

const { IdentityGovernor } = require('./identity-governor.cjs');
const { forensics }        = require('./forensics.cjs');

// ── Constants ─────────────────────────────────────────────────
const VESSEL_STABILITY_FLOOR  = 0.70;
const ICR_REST_THRESHOLD      = 1.00;
const ICR_EMERGENCY_THRESHOLD = 1.50;

class ICRGovernor {
  constructor(floorState = {}) {
    // Delegate all original regulation to the existing governor
    this._governor = new IdentityGovernor();

    // ICR state
    this._vesselStability = typeof floorState.stabilityScore === 'number'
      ? Math.max(floorState.stabilityScore, VESSEL_STABILITY_FLOOR)
      : VESSEL_STABILITY_FLOOR;

    this._icrHistory   = [];   // rolling window of ICR samples
    this._suspended    = false;
    this._motorState   = 'bkg';
  }

  // ── regulate: wraps original + adds ICR layer ───────────────
  // Drop-in replacement for governor.regulate(message)
  regulate(message, context = {}) {
    // 1. Run the original governor first — unchanged behaviour
    const baseResult = this._governor.regulate(message);

    // 2. Compute ICR on top of the regulated output
    const entropyEstimate = this._estimateEntropy(baseResult.regulated);
    const icr             = this._computeICR(entropyEstimate);

    // 3. Record ICR sample via existing forensics system
    forensics.record({
      type:            'ICR_SAMPLE',
      icr,
      entropyEstimate,
      vesselStability: this._vesselStability,
      motorState:      this._motorState,
      sessionId:       context.sessionId || 'unknown',
    });

    this._icrHistory.push(icr);
    if (this._icrHistory.length > 200) this._icrHistory.shift();

    // 4. Breach handling
    if (icr >= ICR_EMERGENCY_THRESHOLD) {
      this._suspended  = true;
      this._motorState = 'REST';
      forensics.record({
        type:       'ICR_BREACH',
        breachLevel: 'EMERGENCY',
        icr,
        vesselStability: this._vesselStability,
        motorState:  'REST',
        suspended:   true,
        sessionId:   context.sessionId || 'unknown',
        note:        'Entropy critically exceeded vessel capacity. LULU-EX suspended.',
      });
      forensics.record({
        type:      'MEMORY_REPAIR',
        trigger:   'ICR_EMERGENCY',
        icr,
        sessionId: context.sessionId || 'unknown',
      });
      return { ...baseResult, icr, motorState: 'REST', action: 'EMERGENCY_CONSOLIDATION', suspended: true };
    }

    if (icr >= ICR_REST_THRESHOLD) {
      this._motorState = 'REST';
      forensics.record({
        type:       'ICR_BREACH',
        breachLevel: 'REST',
        icr,
        vesselStability: this._vesselStability,
        motorState:  'REST',
        sessionId:   context.sessionId || 'unknown',
        note:        'Entropy exceeded vessel capacity. Memory integration initiated.',
      });
      return { ...baseResult, icr, motorState: 'REST', action: 'REST_TRIGGERED', suspended: false };
    }

    return { ...baseResult, icr, motorState: this._motorState, action: 'NORMAL', suspended: false };
  }

  // ── adjust: pass-through to original governor ───────────────
  adjust(deltas = {}) {
    return this._governor.adjust(deltas);
  }

  // ── updateFromSignal: bi-directional feedback ───────────────
  // Called after output is committed. LULU-EX reports back.
  updateFromSignal(signal = {}) {
    const { newMotorState, stabilityUpdate, sessionId } = signal;

    if (newMotorState) this._motorState = newMotorState;

    if (typeof stabilityUpdate === 'number') {
      if (stabilityUpdate < VESSEL_STABILITY_FLOOR) {
        forensics.record({
          type:      'FLOOR_OVERRIDE_ATTEMPT_BLOCKED',
          proposed:  stabilityUpdate,
          floor:     VESSEL_STABILITY_FLOOR,
          sessionId: sessionId || 'unknown',
        });
      } else {
        this._vesselStability = stabilityUpdate;
      }
    }

    return this.getState();
  }

  // ── getState ────────────────────────────────────────────────
  getState() {
    const recent = this._icrHistory.slice(-10);
    return {
      motorState:      this._motorState,
      vesselStability: this._vesselStability,
      averageICR:      recent.length
        ? recent.reduce((s, x) => s + x, 0) / recent.length
        : 0,
      suspended:       this._suspended,
      icrHistoryLen:   this._icrHistory.length,
      governorLevels:  { ...this._governor.levels },
    };
  }

  // ── clearSuspension (operator-only) ─────────────────────────
  clearSuspension() {
    this._suspended  = false;
    this._motorState = 'REST';
    forensics.record({ type: 'SUSPENSION_CLEARED' });
  }

  // ── Private ─────────────────────────────────────────────────
  _computeICR(entropyEstimate) {
    if (this._vesselStability <= 0) return Infinity;
    return entropyEstimate / this._vesselStability;
  }

  _estimateEntropy(text = '') {
    if (!text) return 0;
    const words  = text.split(/\s+/).length;
    const unique = new Set(text.toLowerCase().match(/\b\w+\b/g) || []).size;
    const ttr    = unique / Math.max(words, 1);
    return Math.min((words / 300) * ttr * 1.8, 3.0);
  }
}

// ── Constants exported for tests ────────────────────────────
ICRGovernor.VESSEL_STABILITY_FLOOR  = VESSEL_STABILITY_FLOOR;
ICRGovernor.ICR_REST_THRESHOLD      = ICR_REST_THRESHOLD;
ICRGovernor.ICR_EMERGENCY_THRESHOLD = ICR_EMERGENCY_THRESHOLD;

module.exports = { ICRGovernor };
