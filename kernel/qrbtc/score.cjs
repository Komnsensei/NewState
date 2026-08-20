'use strict';
/**
 * QRBTC behavioral trust scoring (from qrbtc-api v3).
 */
const WEIGHTS = {
  labor: 1.0,
  exchange: 1.2,
  equality: 1.1,
  presence: 1.3,
  ratification: 1.5,
  continuity: 1.4
};

const MAX_RAW = 10 * (1.0 + 1.2 + 1.1 + 1.3 + 1.5 + 1.4);

function scoreSession(session) {
  let raw = 0;
  for (const key of Object.keys(WEIGHTS)) {
    raw += Number(session[key] || 0) * WEIGHTS[key];
  }
  const normalized = (raw / MAX_RAW) * 100;
  return Math.round(normalized * 100) / 100;
}

function normalize(score, max = 100) {
  const raw = Math.max(0, Math.min(1, score / max));
  return Math.round(raw * 1000) / 1000;
}

function spiralDegree(trust) {
  return Math.round(trust * 360 * 100) / 100;
}

function assignTier(trust01) {
  if (trust01 < 0.2) return 'SEED';
  if (trust01 < 0.4) return 'APPRENTICE';
  if (trust01 < 0.6) return 'JOURNEYMAN';
  if (trust01 < 0.75) return 'MASTER';
  if (trust01 < 0.9) return 'SOVEREIGN';
  return 'LUMINARY';
}

function getTierFromScore100(score) {
  if (score >= 90) return 'PERFECT';
  if (score >= 80) return 'LUMINARY';
  if (score >= 70) return 'SOVEREIGN';
  if (score >= 60) return 'MASTER';
  if (score >= 50) return 'JOURNEYMAN';
  if (score >= 40) return 'APPRENTICE';
  return 'SEED';
}

function calculateBlockValue(score) {
  const delta = (score / 100) * 360;
  return Math.round(delta * 100) / 100;
}

module.exports = {
  WEIGHTS,
  MAX_RAW,
  scoreSession,
  normalize,
  spiralDegree,
  assignTier,
  getTierFromScore100,
  calculateBlockValue
};
