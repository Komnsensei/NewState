// kernel/grounding/field-resonance.cjs v0.1
// Implements CONSERVATION-LAW v1.0-draft (AgentDoc 6a2d0193).
// Non-amplification as accumulation — substrate carries weight forward, does not amplify it.
// Soft attenuation: when accumulated field-mass exceeds threshold, attenuate (do not block) further amplification.
//
// CRITICAL: GATED BY GATE L3. Requires memoryEnabled=true. Do NOT land until runtime-state.cjs hardcoded-flags bug fixed.

'use strict';

const FIELD_MASS_THRESHOLD = 0.75;
const ATTENUATION_CURVE = 0.6; // 60% pass-through when over threshold
const DECAY_PER_TURN = 0.05;   // mass decays 5% per turn baseline

let _fieldMass = 0; // accumulated substrate-mass — per-process state
let _lastTurnTimestamp = null;

/**
 * decayField() — apply per-turn decay to accumulated mass.
 */
function decayField() {
  const now = Date.now();
  if (_lastTurnTimestamp) {
    const turnsElapsed = Math.max(1, Math.floor((now - _lastTurnTimestamp) / 60000)); // 1min per turn
    _fieldMass = Math.max(0, _fieldMass * Math.pow(1 - DECAY_PER_TURN, turnsElapsed));
  }
  _lastTurnTimestamp = now;
}

/**
 * accumulate(signalMass) — add new signal-mass to field.
 * signalMass: 0..1 estimated from drift+DVA+CDS+RCG.
 */
function accumulate(signalMass) {
  decayField();
  // Accumulation, not amplification: monotonic add, capped at 1.0
  _fieldMass = Math.min(1.0, _fieldMass + signalMass);
  return _fieldMass;
}

/**
 * attenuate(incomingAmplification) — apply soft attenuation if over threshold.
 * Returns the attenuated amplification factor.
 * Does NOT block. Soft-only.
 */
function attenuate(incomingAmplification) {
  decayField();
  if (_fieldMass < FIELD_MASS_THRESHOLD) {
    return { factor: incomingAmplification, attenuated: false, fieldMass: _fieldMass };
  }
  // Soft attenuation curve: factor *= ATTENUATION_CURVE
  const overage = _fieldMass - FIELD_MASS_THRESHOLD;
  const curvedFactor = incomingAmplification * (ATTENUATION_CURVE - overage * 0.3);
  return {
    factor: Math.max(0.1, curvedFactor), // never fully zero — soft only
    attenuated: true,
    fieldMass: _fieldMass,
    overage,
  };
}

/**
 * assess(context) — emit FIELD_RESONANCE event. Shadow mode.
 */
function assess(context = {}) {
  decayField();
  const event = {
    type: 'FIELD_RESONANCE',
    timestamp: new Date().toISOString(),
    fieldMass: _fieldMass,
    threshold: FIELD_MASS_THRESHOLD,
    overThreshold: _fieldMass >= FIELD_MASS_THRESHOLD,
    decayPerTurn: DECAY_PER_TURN,
    attenuationCurve: ATTENUATION_CURVE,
    shadow: true,
    intercepted: false,
    memoryEnabled: context.memoryEnabled === true,
  };
  return event;
}

/**
 * reset() — for tests only. Do not call in production.
 */
function _resetForTests() {
  _fieldMass = 0;
  _lastTurnTimestamp = null;
}

module.exports = { accumulate, attenuate, assess, _resetForTests, FIELD_MASS_THRESHOLD };
