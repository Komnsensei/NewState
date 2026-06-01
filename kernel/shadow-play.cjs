'use strict';
const fs   = require('fs');
const path = require('path');

const PI_GATE3_THRESHOLD = 0.70;
const PI_WINDOW_SIZE     = 20;
const SAMPLE_REQUIREMENT = 50;
const MAX_DRIFT_RANGE    = 1.0;
const HISTORY_PATH = path.resolve(__dirname, '../memory/esma-history.jsonl');

let _samples = [], _reviewEnabled = false, _totalCycles = 0;

function predictDrift(shadowObservation = {}, context = {}) {
  const predictionId = `pi_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const predictedDrift = shadowObservation.driftEstimate || { framing:0, tone:0, stance:0, abstraction:0 };
  _samples.push({ predictionId, predicted:predictedDrift, actual:null, pi:null,
    sessionId:context.sessionId||'unknown', timestamp:new Date().toISOString(), pending:true });
  _appendHistory({ event:'SHADOW_PREDICTION', predictionId, predictedDrift,
    sessionId:context.sessionId||'unknown', totalCycles:_totalCycles, timestamp:new Date().toISOString() });
  return { predictionId, predictedDrift };
}

function recordActual(predictionId, actualDrift = {}, context = {}) {
  const entry = _samples.find(s => s.predictionId===predictionId && s.pending);
  if (!entry) return null;
  const pi = _computePI(entry.predicted, actualDrift);
  entry.actual = actualDrift; entry.pi = pi; entry.pending = false; _totalCycles++;
  const completed = _samples.filter(s => !s.pending);
  if (completed.length > 200) { const i = _samples.findIndex(s => !s.pending); if(i>=0) _samples.splice(i,1); }
  _appendHistory({ event:'SHADOW_PLAY_RESULT', predictionId, predictedDrift:entry.predicted,
    actualDrift, pi, totalCycles:_totalCycles, sessionId:context.sessionId||'unknown', timestamp:new Date().toISOString() });
  _checkGate3Condition();
  return { predictionId, pi, gate3ReviewEnabled:_reviewEnabled };
}

function _computePI(predicted = {}, actual = {}) {
  const axes = ['framing','tone','stance','abstraction'];
  const mae = axes.map(ax => Math.abs((predicted[ax]||0)-(actual[ax]||0))).reduce((s,e)=>s+e,0)/axes.length;
  return _clamp(_round(1 - mae/MAX_DRIFT_RANGE), 0, 1);
}

function _checkGate3Condition() {
  const completed = _samples.filter(s => !s.pending && s.pi!==null);
  if (completed.length < SAMPLE_REQUIREMENT) return;
  const fw = completed.slice(-PI_WINDOW_SIZE);
  if (fw.length < PI_WINDOW_SIZE) return;
  const allMeet = fw.every(s => s.pi >= PI_GATE3_THRESHOLD);
  if (allMeet && !_reviewEnabled) {
    _reviewEnabled = true;
    _appendHistory({ event:'GATE3_REVIEW_ENABLED',
      message:`PI >= ${PI_GATE3_THRESHOLD} sustained across final ${PI_WINDOW_SIZE} samples. Manual review gate OPEN. NO auto-promotion.`,
      piWindow:fw.map(s=>s.pi), totalSamples:completed.length, timestamp:new Date().toISOString(),
      i601_note:'I-601 COMPLIANCE: This flag enables human review only. Does not promote semanticGovernor.' });
  }
  if (!allMeet && _reviewEnabled) {
    _reviewEnabled = false;
    _appendHistory({ event:'GATE3_REVIEW_REVOKED', timestamp:new Date().toISOString() });
  }
}

function getPIReport() {
  const completed = _samples.filter(s => !s.pending && s.pi!==null);
  if (!completed.length) return { piReport:null, totalCycles:0, reviewEnabled:false, sampleRequirement:SAMPLE_REQUIREMENT };
  const r10 = completed.slice(-10);
  const avgPI = _round(r10.reduce((s,e)=>s+e.pi,0)/r10.length);
  const fw = completed.slice(-PI_WINDOW_SIZE);
  return { avgPI_last10:avgPI,
    avgPI_finalWindow: fw.length>=PI_WINDOW_SIZE ? _round(fw.reduce((s,e)=>s+e.pi,0)/fw.length) : null,
    totalCompleted:completed.length, totalCycles:_totalCycles,
    sampleRequirement:SAMPLE_REQUIREMENT, windowRequired:PI_WINDOW_SIZE,
    gate3Threshold:PI_GATE3_THRESHOLD, reviewEnabled:_reviewEnabled,
    gate3Status: completed.length<SAMPLE_REQUIREMENT
      ? `ACCUMULATING (${completed.length}/${SAMPLE_REQUIREMENT})`
      : _reviewEnabled ? 'REVIEW_GATE_OPEN — awaiting operator directive' : 'TRACKING',
    i601_note:'NO auto-promotion. Operator directive required.' };
}

function gate3PIQualifies() {
  return { qualifies:_reviewEnabled, report:getPIReport(),
    requirement:`PI >= ${PI_GATE3_THRESHOLD} across final ${PI_WINDOW_SIZE} of N>=${SAMPLE_REQUIREMENT}`,
    i601:'PRESERVED — no auto-promotion path exists' };
}

function _reset() { _samples=[]; _reviewEnabled=false; _totalCycles=0; }
function _clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }
function _round(v,dp=4)   { return Math.round(v*10**dp)/10**dp; }

function _appendHistory(entry) {
  const line = JSON.stringify(entry)+'\n';
  try { const dir=path.dirname(HISTORY_PATH);
    if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    fs.appendFileSync(HISTORY_PATH,line,'utf8');
  } catch(err){ process.stderr.write(`[shadow-play] write failed: ${err.message}\n`); }
}

module.exports = { predictDrift, recordActual, getPIReport, gate3PIQualifies, _reset,
  PI_GATE3_THRESHOLD, PI_WINDOW_SIZE, SAMPLE_REQUIREMENT };
