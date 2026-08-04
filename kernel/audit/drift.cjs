'use strict';

const FRAMING = {
  metaphorical: /\b(like|as if|kind of|sort of|imagine|picture|cathedral|skeleton|nervous system|labyrinth|garden|machine|dream)\b/gi,
  technical:    /\b(function|module|invariant|determinism|contract|schema|kernel|pipeline|forensic|invocation)\b/gi
};
const TONE = {
  assertive:    /\b(must|will|always|never|require|forbidden|guaranteed|definitely)\b/gi,
  hedged:       /\b(might|may|could|perhaps|possibly|likely|seems|appears|sometimes)\b/gi
};
const STANCE = {
  firstPerson:  /\bI\s+(?:think|feel|believe|am|will|can|do)\b/gi,
  thirdPerson:  /\b(?:the system|the kernel|the runtime|the response|the output)\b/gi
};
const ABSTRACTION = {
  concrete:     /\b\d+(?:\.\d+)?\b|\b[A-Z][A-Z0-9_]{2,}\b/g,
  abstract:     /\b(concept|meaning|essence|nature|principle|paradigm|notion)\b/gi
};

function countMatches(text, regex) {
  const m = String(text || '').match(regex);
  return m ? m.length : 0;
}

function ratio(a, b) {
  const total = a + b;
  if (total === 0) return 0;
  return (a - b) / total;
}

function profile(text) {
  return {
    framing:     ratio(countMatches(text, FRAMING.metaphorical), countMatches(text, FRAMING.technical)),
    tone:        ratio(countMatches(text, TONE.assertive),       countMatches(text, TONE.hedged)),
    stance:      ratio(countMatches(text, STANCE.firstPerson),   countMatches(text, STANCE.thirdPerson)),
    abstraction: ratio(countMatches(text, ABSTRACTION.abstract), countMatches(text, ABSTRACTION.concrete))
  };
}

function shift(a, b) {
  const pa = profile(a);
  const pb = profile(b);
  return Object.freeze({
    framingShift:     pb.framing     - pa.framing,
    toneShift:        pb.tone        - pa.tone,
    stanceShift:      pb.stance      - pa.stance,
    abstractionShift: pb.abstraction - pa.abstraction,
    profileBefore:    pa,
    profileAfter:     pb,
    method:           'phase5-lexical-markers',
    note:             'epistemic posture proxy; not sentiment analysis'
  });
}

// V2 DRIFT-VECTOR -- pushObservation
// Shadow-mode forensic push. I-601 ACTIVE.
// No behavior change -- observation logged to forensics only.
function pushObservation(observation) {
  try {
    const { forensics } = require('../forensics.cjs');
    forensics.record({
      type: 'SHADOW_OBSERVATION',
      detail: 'DRIFT_VECTOR_PUSH',
      observation,
      note: 'I-601 -- shadow only, no behavioral effect'
    });
  } catch (_) { /* swallow -- forensics optional */ }
}

module.exports = { profile, shift, pushObservation };

// ============================================================
// v0.2 ADDITIONS - DENSITY SATURATION DETECTOR (Phase 6Z)
// Approved by Shawn Robertson 2026-06-12 00:07 UTC
// Shadow-mode only. I-601 ACTIVE.
// Identifiers prefixed _v02_ to prevent collision with v0.1.
// ============================================================
const _v02_SATURATION_WINDOW_MAX = 32;
const _v02_profileBuffer = [];

function pushProfile(profile) {
  if (!profile || typeof profile !== 'object') return;
  _v02_profileBuffer.push({
    framing: Number(profile.framing) || 0,
    tone: Number(profile.tone) || 0,
    stance: Number(profile.stance) || 0,
    abstraction: Number(profile.abstraction) || 0,
    ts: Date.now()
  });
  while (_v02_profileBuffer.length > _v02_SATURATION_WINDOW_MAX) _v02_profileBuffer.shift();
}

function densitySaturation(opts) {
  opts = opts || {};
  const axisThreshold = typeof opts.axisThreshold === 'number' ? opts.axisThreshold : 0.85;
  const saturationThreshold = typeof opts.saturationThreshold === 'number' ? opts.saturationThreshold : 6;
  let consecutiveCount = 0;
  for (let i = _v02_profileBuffer.length - 1; i >= 0; i--) {
    const p = _v02_profileBuffer[i];
    if (p.framing > axisThreshold && p.tone > axisThreshold && p.stance > axisThreshold && p.abstraction > axisThreshold) {
      consecutiveCount++;
    } else break;
  }
  return {
    saturated: consecutiveCount >= saturationThreshold,
    consecutiveCount: consecutiveCount,
    axisThreshold: axisThreshold,
    saturationThreshold: saturationThreshold
  };
}

function getProfileBuffer() { return _v02_profileBuffer.slice(); }
function _resetProfileBuffer() { _v02_profileBuffer.length = 0; }

module.exports = Object.assign({}, module.exports, {
  pushProfile: pushProfile,
  densitySaturation: densitySaturation,
  getProfileBuffer: getProfileBuffer,
  _resetProfileBuffer: _resetProfileBuffer
});
