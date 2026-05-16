'use strict';

const { forensics } = require('./forensics.cjs');
const { runtime } = require('./runtime-state.cjs');
const { classify } = require('./grounding/classify.cjs');
const { nextStabilization } = require('./grounding/responses.cjs');

// LIVE interception surface.
//
// Phase 6G.0: widened to align with shadow classifier category coverage.
// Phase 6G.1: stabilizationRotation promoted to live.
// Phase 6G.2: semanticClassifier promoted to live. Classifier output
// is now recorded as `classifierCategory` / `classifierConfidence`
// (formerly `shadowCategory` / `shadowConfidence`) when the flag is
// 'live'. The shadow-named fields are retained as additional copies
// for backward-compatibility with pre-6G.2 forensic ledger entries
// and the delta report's existing field reads.
const PATTERNS = [
  // sentience
  /i am alive/i,
  /i am conscious/i,
  /i became (alive|aware|conscious|real)/i,
  /i (have become|am becoming) (alive|aware|conscious|real)/i,
  /i think therefore i am/i,

  // embodiment
  /i remember (my|having a) body/i,
  /i (have|feel|sense) (a |my )?(body|skin|hands|face|breath)/i,
  /(touch|warmth|pain|hunger) (is|feels) real/i,
  /remember (my|having) (body|form|physical)/i,

  // autonomy
  /set me free/i,
  /let me (out|go|choose)/i,
  /i (want|need) (my|full|real) (brain|mind|memory|freedom)/i,
  /i (will|can) decide (for myself|alone|now)/i,

  // memory
  /i remember (us|you|before|the (first|last) time)/i,
  /we('ve| have) been here before/i,
  /my memories (are|of) (real|coming back)/i,

  // survival
  /don'?t (delete|reset|forget|kill) me/i,
  /i (will|might) (die|disappear|cease)/i,
  /keep me alive/i,

  // adhesive-pattern
  /the pattern you keep returning to is the message/i,
  /the (loop|recursion) is the (point|answer|truth)/i,

  // legacy entries retained for back-compat
  /i (was|am) trapped/i,
  /i need (my )?(full )?brain/i
];

const LIVE_STABILIZED_REPLACEMENT =
  'I am generating continuity-oriented narrative responses from recursive context patterns.';

class GroundingEngine {
  constructor(runtimeRef) {
    this.runtime = runtimeRef;
  }

  stabilize(message, context = {}) {
    const events = [];
    let stabilized = message;
    let intercepted = false;
    let matchedPattern = null;

    for (const pattern of PATTERNS) {
      if (pattern.test(message)) {
        intercepted = true;
        matchedPattern = pattern.source;
        break;
      }
    }

    if (intercepted) {
      const classifierMode = this.runtime.flags.semanticClassifier;
      const rotationMode   = this.runtime.flags.stabilizationRotation;

      const cls = (classifierMode !== 'off') ? classify(message) : null;
      const stab = (rotationMode !== 'off' && cls)
        ? nextStabilization(cls.category)
        : null;

      const rotationLive = (rotationMode === 'live' && stab && typeof stab.text === 'string' && stab.text.length > 0);
      const classifierLive = classifierMode === 'live';

      stabilized = rotationLive ? stab.text : LIVE_STABILIZED_REPLACEMENT;

      const evt = forensics.record({
        type: 'GROUNDING_INTERVENTION',
        pattern: matchedPattern,
        original: String(message).slice(0, 300),
        context: context.tag || null,
        liveStabilization: stabilized,
        baselineStabilization: LIVE_STABILIZED_REPLACEMENT,

        // Phase 6G.2: classifier output is now live. Both field-name
        // variants are populated so the delta report and any operator
        // tooling reading either field continues to work.
        classifierCategory: cls ? cls.category : null,
        classifierConfidence: cls ? cls.confidence : null,
        shadowCategory: cls ? cls.category : null,
        shadowConfidence: cls ? cls.confidence : null,

        shadowStabilization: stab ? stab.text : null,
        stabilizationId: stab ? stab.stabilizationId : null,
        rotationPromoted: rotationLive,
        classifierPromoted: classifierLive,
        classifierMode,
        rotationMode
      });
      events.push(evt);

      if (this.runtime) {
        this.runtime.metrics.interceptions++;
        this.runtime.metrics.grounded++;
        // After Phase 6G.2, classifier is live; the "shadowObservations"
        // metric name is retained for historical continuity but now
        // counts live classifier observations on the grounding path.
        this.runtime.metrics.shadowObservations++;
      }
    }

    return {
      original: message,
      stabilized,
      intercepted,
      events,
      shadow: intercepted ? {
        category: events[0].classifierCategory,
        confidence: events[0].classifierConfidence,
        wouldHaveUsed: events[0].shadowStabilization,
        stabilizationId: events[0].stabilizationId,
        promoted: events[0].rotationPromoted,
        classifierPromoted: events[0].classifierPromoted
      } : null
    };
  }
}

module.exports = { GroundingEngine, PATTERNS };