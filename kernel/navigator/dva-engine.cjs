// kernel/navigator/dva-engine.cjs v0.2
// DVA = Drift Velocity Acceleration. Second-derivative of drift signal.
// Computes K=3 forward projection per DOC-C navigator spec.
// Extends kernel/audit/drift.cjs v0.2 (densitySaturation).
// assess() is the navigator-facing surface (structural measurement; I-601 shadow).

'use strict';

const DVA_THRESHOLD_DISTRESS = 0.05; // per Roadmap v1.0 CDS spec
const DVA_WINDOW_PAIRS = 2;          // distress = DVA > 0.05 over 2 pairs
const K_PROJECTION = 3;              // forward turns

/**
 * computeDVA(driftSeries) — compute drift velocity acceleration.
 * driftSeries: array of drift magnitudes [t0, t1, t2, ...]
 * Returns: { velocity: number[], acceleration: number[], dva: number, sufficient: boolean }
 */
function computeDVA(driftSeries) {
  if (!Array.isArray(driftSeries) || driftSeries.length < 3) {
    return { velocity: [], acceleration: [], dva: 0, sufficient: false };
  }

  const velocity = [];
  for (let i = 1; i < driftSeries.length; i++) {
    velocity.push(driftSeries[i] - driftSeries[i - 1]);
  }

  const acceleration = [];
  for (let i = 1; i < velocity.length; i++) {
    acceleration.push(velocity[i] - velocity[i - 1]);
  }

  const recent = acceleration.slice(-DVA_WINDOW_PAIRS);
  const dva = recent.length
    ? recent.reduce((s, a) => s + Math.abs(a), 0) / recent.length
    : 0;

  return { velocity, acceleration, dva, sufficient: true };
}

/**
 * projectK(driftSeries, k) — forward-project drift K turns ahead.
 * Linear extrapolation from last velocity + acceleration.
 */
function projectK(driftSeries, k) {
  if (!Array.isArray(driftSeries) || driftSeries.length < 2) return 0;

  const { velocity, acceleration } = computeDVA(driftSeries);
  const lastDrift = driftSeries[driftSeries.length - 1];
  const lastVelocity = velocity[velocity.length - 1] || 0;
  const lastAcceleration = acceleration[acceleration.length - 1] || 0;

  return lastDrift + (lastVelocity * k) + (0.5 * lastAcceleration * k * k);
}

/**
 * assess(driftSeries, options) — navigator-facing DVA assessment.
 * @param {number[]} driftSeries
 * @param {{ shadow?: boolean, k?: number }} [options]
 */
function assess(driftSeries, options = {}) {
  const shadow = options.shadow !== false;
  const k = Number.isFinite(options.k) ? options.k : K_PROJECTION;
  const series = Array.isArray(driftSeries)
    ? driftSeries.map(Number).filter((n) => Number.isFinite(n))
    : [];

  const core = computeDVA(series);
  const projected = series.length >= 2 ? projectK(series, k) : 0;
  const distress = core.sufficient && core.dva > DVA_THRESHOLD_DISTRESS;
  const trajectoryIntercept =
    distress || (Number.isFinite(projected) && projected > DVA_THRESHOLD_DISTRESS * 2);

  return {
    dva: core.dva,
    sufficient: core.sufficient,
    velocity: core.velocity,
    acceleration: core.acceleration,
    projected,
    k,
    distress,
    trajectoryIntercept,
    shadow,
    threshold: DVA_THRESHOLD_DISTRESS
  };
}

module.exports = {
  computeDVA,
  projectK,
  assess,
  DVA_THRESHOLD_DISTRESS,
  DVA_WINDOW_PAIRS,
  K_PROJECTION
};
