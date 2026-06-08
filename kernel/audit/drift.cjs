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
