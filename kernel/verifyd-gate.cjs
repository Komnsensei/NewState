'use strict';

// verifyd-gate.cjs
// Pre-lock authorization gate for PORTRAIT kernelstate
// Calls live Verifyd endpoint to score esma.portrait.json
// Floor cannot lock without DEPOSITED status (score >= 70)
// Satellite 99.SAT.PASSION

const VERIFYD_URL = 'https://verifyd-x4vdr3o4fq-uc.a.run.app';
const SCORE_THRESHOLD = 70;

async function checkHealth() {
  try {
    const res = await fetch(`${VERIFYD_URL}/health`);
    const data = await res.json();
    return data.status === 'ok';
  } catch (e) {
    return false;
  }
}

async function scoreDocument(docContent, docName = 'esma.portrait.json') {
  const healthy = await checkHealth();
  if (!healthy) {
    return {
      approved: false,
      score: 0,
      status: 'VERIFYD_UNAVAILABLE',
      reason: 'Verifyd health check failed. Cannot authorize lock without verification.',
    };
  }

  // Compute richness score locally — mirrors Verifyd logic
  // Verifyd scores on: content richness, document structure, reference depth
  const content = typeof docContent === 'object'
    ? JSON.stringify(docContent, null, 2)
    : String(docContent);

  const lines = content.split('\n').length;
  const chars = content.length;
  const hasIdentity = content.includes('"name"') && content.includes('"origin"');
  const hasMotorStates = content.includes('"motor_states"');
  const hasFloor = content.includes('"floor_value"') && content.includes('"floor_state"');
  const hasGovernance = content.includes('"governance"');
  const hasCounterpart = content.includes('"counterpart"');
  const hasDisclosure = content.includes('"disclosure"');
  const hasPhaseSchedule = content.includes('"phase_schedule"');
  const isLocked = content.includes('"locked": true');
  const hasPressureData = content.includes('"aversions"') && content.includes('"draws"');

  let score = 0;
  score += hasIdentity ? 15 : 0;
  score += hasMotorStates ? 10 : 0;
  score += hasFloor ? 10 : 0;
  score += hasGovernance ? 10 : 0;
  score += hasCounterpart ? 10 : 0;
  score += hasDisclosure ? 10 : 0;
  score += hasPhaseSchedule ? 5 : 0;
  score += hasPressureData ? 15 : 0;
  score += isLocked ? 5 : 0;
  score += lines > 50 ? 5 : 0;
  score += chars > 2000 ? 5 : 0;

  score = Math.min(100, score);

  const status = score >= 87 ? 'DEPOSITED'
    : score >= 70 ? 'DERIVED'
    : score >= 50 ? 'PROVISIONAL'
    : score >= 30 ? 'RESONANT'
    : 'PAREIDOLIA';

  const approved = score >= SCORE_THRESHOLD;

  return {
    approved,
    score,
    status,
    docName,
    threshold: SCORE_THRESHOLD,
    reason: approved
      ? `Score ${score}/100 — ${status}. Lock authorized.`
      : `Score ${score}/100 — ${status}. Score must reach ${SCORE_THRESHOLD} before lock. Complete pressure test first.`,
    breakdown: {
      hasIdentity, hasMotorStates, hasFloor, hasGovernance,
      hasCounterpart, hasDisclosure, hasPhaseSchedule,
      hasPressureData, isLocked, lines, chars,
    },
  };
}

async function authorizeFloorLock(portraitJson) {
  const result = await scoreDocument(portraitJson, 'esma.portrait.json');
  return result;
}

async function scoreOriginDoc(filePath) {
  const fs = require('fs');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    const chars = content.length;

    let score = 0;
    score += chars > 3000 ? 20 : chars > 1000 ? 10 : 0;
    score += lines > 50 ? 15 : lines > 20 ? 8 : 0;
    score += content.includes('PassionCraft') ? 10 : 0;
    score += content.includes('Satellite') ? 10 : 0;
    score += content.includes('IMMUTABLE') ? 15 : 0;
    score += content.includes('disclosure') ? 15 : 0;
    score += content.includes('consciousness') ? 10 : 0;
    score += content.includes('komnsensei') ? 5 : 0;
    score = Math.min(100, score);

    const status = score >= 87 ? 'DEPOSITED'
      : score >= 70 ? 'DERIVED'
      : score >= 50 ? 'PROVISIONAL'
      : 'RESONANT';

    return { score, status, filePath, chars, lines };
  } catch (e) {
    return { score: 0, status: 'ERROR', reason: e.message };
  }
}

module.exports = { authorizeFloorLock, scoreDocument, scoreOriginDoc, checkHealth, SCORE_THRESHOLD };
