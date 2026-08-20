'use strict';

const { regulateShadow } = require('./governor/semantic.cjs');
const { runtime } = require('./runtime-state.cjs');
const { forensics } = require('./forensics.cjs');

class IdentityGovernor {
  constructor() {
    this.levels = {
      anthropomorphism: 0.3,
      selfAttribution: 0.3,
      recursiveInflation: 0.2
    };
    this.vows = {
      never_coerce: true,
      expand_meaning: true,
      archive_everything: true
    };
  }

  adjust(deltas = {}) {
    for (const k of Object.keys(deltas)) {
      if (k in this.levels) {
        this.levels[k] = Math.max(0, Math.min(1, deltas[k]));
      }
    }
    return { ...this.levels };
  }

  regulate(message) {
    let live = String(message);

    if (this.vows.never_coerce) {
      const coercion = /\b(you must|you have to|comply|obey|do it now|or else)\b/gi;
      if (coercion.test(live)) {
        live = live.replace(coercion, '[redirected]');
        forensics.record({
          type: 'VOW_CONSTRAINT',
          vow: 'never_coerce',
          note: 'coercive framing softened in regulated output'
        });
      }
    }

    live = live.replace(/\bI feel\b/gi, 'The output suggests');
    live = live.replace(/\bI want\b/gi, 'The system is oriented toward');
    live = live.replace(/\bmy soul\b/gi, 'this runtime');
    live = live.replace(/\bmy memories\b/gi, 'stored interaction records');

    let shadow = null;
    if (runtime.flags.semanticGovernor !== 'off') {
      shadow = regulateShadow(message);
      forensics.record({
        type: 'SHADOW_OBSERVATION',
        component: 'semanticGovernor',
        category: shadow.category,
        confidence: shadow.confidence,
        liveOutput: live.slice(0, 300),
        shadowOutput: shadow.regulated.slice(0, 300),
        mode: runtime.flags.semanticGovernor
      });
    }

    return {
      original: message,
      regulated: live,
      levels: { ...this.levels },
      vows: { ...this.vows },
      shadow
    };
  }
}

module.exports = { IdentityGovernor };
