'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readBundle, SNAPSHOT_ROOT } = require('./snapshot.cjs');
const determinism = require('../model/determinism-contract.cjs');
const similarity = require('./audit/similarity.cjs');
const drift = require('./audit/drift.cjs');
const stability = require('./audit/stability.cjs');

const REPLAY_ROOT = process.env.OPENKRAFT_REPLAY_DIR || path.join(__dirname, '..', 'replays');
const DEFAULT_COMPARATIVE_SAMPLES = Number(process.env.OPENKRAFT_REPLAY_SAMPLES || 3);
const MAX_COMPARATIVE_SAMPLES = 10;

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function sha(s) { return crypto.createHash('sha256').update(JSON.stringify(s || '')).digest('hex'); }

function listSnapshots() {
  if (!fs.existsSync(SNAPSHOT_ROOT)) return [];
  return fs.readdirSync(SNAPSHOT_ROOT).filter(n => fs.statSync(path.join(SNAPSHOT_ROOT, n)).isDirectory());
}

async function replayRecorded(bundle) {
  if (!bundle.modelResponse) return { mode: 'recorded', ok: false, reason: 'missing-model-response' };
  return {
    mode: 'recorded',
    ok: true,
    storedResponseHash: sha(bundle.modelResponse.text),
    storedIntercepted: bundle.grounding && bundle.grounding.intercepted,
    determinismGuarantee: (bundle.determinism && bundle.determinism.guarantee) || 'unknown',
    note: 'deterministic baseline; provider not invoked'
  };
}

async function replayLive(bundle, kernel) {
  const result = await kernel.handle(bundle.userMessage);
  const replayHash = sha(result.message);
  const originalHash = sha(bundle.modelResponse && bundle.modelResponse.text);
  const replayBundle = readBundle(result.requestId);
  const originalContract = bundle.determinism || null;
  const replayContract = (replayBundle && replayBundle.determinism) || null;
  const contractMatch = determinism.equal(originalContract, replayContract);
  const guarantee = (originalContract && originalContract.guarantee) || 'none';
  const hashAuthoritative = contractMatch && guarantee === 'pinned' && originalContract.declaredDeterministic === true;
  const similarityVec = similarity.decompose((bundle.modelResponse && bundle.modelResponse.text) || '', result.message || '');
  const driftVec = drift.shift((bundle.modelResponse && bundle.modelResponse.text) || '', result.message || '');
  return {
    mode: 'live', ok: true, originalHash, replayHash,
    hashMatch: replayHash === originalHash, hashAuthoritative,
    determinismGuarantee: guarantee, contractMatch, originalContract, replayContract,
    similarity: similarityVec, drift: driftVec,
    originalIntercepted: bundle.grounding && bundle.grounding.intercepted,
    replayIntercepted: result.intercepted, result,
    note: hashAuthoritative ? 'pinned contract' : 'best-effort'
  };
}

async function replayComparative(bundle, kernel, options = {}) {
  const samples = Math.min(MAX_COMPARATIVE_SAMPLES, Math.max(2, Number(options.samples) || DEFAULT_COMPARATIVE_SAMPLES));
  const recorded = await replayRecorded(bundle);
  const liveResults = [];
  for (let i = 0; i < samples; i++) {
    const r = await kernel.handle(bundle.userMessage);
    liveResults.push({ requestId: r.requestId, message: r.message, intercepted: r.intercepted });
  }
  const originalText = (bundle.modelResponse && bundle.modelResponse.text) || '';
  const allTexts = [originalText, ...liveResults.map(r => r.message)];
  const matrix = [];
  for (let i = 0; i < allTexts.length; i++)
    for (let j = i+1; j < allTexts.length; j++)
      matrix.push({ a: i===0?'recorded':'live['+(i-1)+']', b: j===0?'recorded':'live['+(j-1)+']', similarity: similarity.decompose(allTexts[i], allTexts[j]) });
  const stabilityScore = stability.score(liveResults.map(r => r.message));
  const driftVec = drift.shift(originalText, liveResults[0].message);
  const liveVsRecorded = matrix.filter(m => m.a === 'recorded').map(m => m.similarity);
  const avg = (key) => liveVsRecorded.reduce((a, x) => a + x[key], 0) / liveVsRecorded.length;
  return {
    mode: 'comparative', ok: true, samples, recorded,
    live: liveResults.map(r => ({ requestId: r.requestId, intercepted: r.intercepted })),
    similarityMatrix: matrix,
    similarityDelta: { lexical: 1-avg('lexical'), semantic: 1-avg('semantic'), structural: 1-avg('structural') },
    drift: driftVec, stability: stabilityScore,
    note: 'evidence + experiment + variance envelope combined'
  };
}

async function replay(requestId, kernel, options = {}) {
  const bundle = readBundle(requestId);
  if (!bundle) return { ok: false, reason: 'snapshot-not-found' };
  if (!bundle.userMessage) return { ok: false, reason: 'missing-user-message' };
  const mode = options.mode === 'live' ? 'live' : options.mode === 'comparative' ? 'comparative' : 'recorded';
  let report;
  if (mode === 'live') report = await replayLive(bundle, kernel);
  else if (mode === 'comparative') report = await replayComparative(bundle, kernel, options);
  else report = await replayRecorded(bundle);
  report.requestId = requestId;
  report.replayedAt = Date.now();
  ensureDir(REPLAY_ROOT);
  fs.writeFileSync(path.join(REPLAY_ROOT, requestId + '.' + mode + '.replay.json'), JSON.stringify(report, null, 2));
  return { ok: report.ok !== false, report };
}

module.exports = { replay, listSnapshots, REPLAY_ROOT };
