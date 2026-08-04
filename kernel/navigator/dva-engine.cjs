// kernel/navigator/dva-engine.cjs v0.1
// DVA = Drift Velocity Acceleration. Second-derivative of drift signal.
// Computes K=3 forward projection per DOC-C navigator spec.
// Extends kernel/audit/drift.cjs v0.2 (densitySaturation). Shadow mode ONLY.

'use strict';

const DVA_THRESHOLD_DISTRESS = 0.05; // per Roadmap v1.0 CDS spec
const DVA_WINDOW_PAIRS = 2;          // distress = DVA > 0.05 over 2 pairs
const K_PROJECTION = 3;              // forward turns

/**
 * computeDVA(driftSeries) — compute drift velocity acceleration.
 * driftSeries: array of drift magnitudes [t0, t1, t2, ...]
 * Returns: { velocity: number[], acceleration: number[], dva: number }
 */
function computeDVA(driftSeries) {
  if (!Array.isArray(driftSeries) || driftSeries.length < 3) {
    return { velocity: [], acceleration: [], dva: 0, sufficient: false };
  }

  // First derivative: velocity = d(drift)/d(turn)
  const velocity = [];
  for (let i = 1; i < driftSeries.length; i++) {
    velocity.push(driftSeries[i] - driftSeries[i - 1]);
  }

  // Second derivative: acceleration = d(velocity)/d(turn)
  const acceleration = [];
  for (let i = 1; i < velocity.length; i++) {
    acceleration.push(velocity[i] - velocity[i - 1]);
  }

  // DVA = mean absolute acceleration over last DVA_WINDOW_PAIRS
  const recent = acceleration.slice(-DVA_WINDOW_PAIRS);
  const dva = recent.length
    ? recent.reduce((s, a) => s + Math.abs(a), 0) / recent.length
    : 0;

  return { velocity, acceleration, dva, sufficient: true };
}

/**
 * projectK(driftSeries, k) — forward-project drift K turns ahead.
 * Linear extrapolation from last velocity + acceleration.
 * @param {number[]} driftSeries - array of drift magnitudes
 * @param {number} k - number of turns to project ahead
 * @returns {number} - projected drift magnitude
 */
function projectK(driftSeries, k) {
  if (!Array.isArray(driftSeries) || driftSeries.length < 2) return 0;

  const { velocity, acceleration } = computeDVA(driftSeries);
  const lastDrift = driftSeries[driftSeries.length - 1];
  const lastVelocity = velocity[velocity.length - 1] || 0;
  const lastAcceleration = acceleration[acceleration.length - 1] || 0;

  // Simple linear extrapolation: D_k = D_0 + V_0*k + 0.5*A_0*k^2
  return lastDrift + (lastVelocity * k) + (0.5 * lastAcceleration * k * k);
}

module.exports = { computeDVA, projectK, DVA_THRESHOLD_DISTRESS, DVA_WINDOW_PAIRS, K_PROJECTION };
