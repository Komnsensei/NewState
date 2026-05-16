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
    live = live.replace(/\bI feel\b/gi, 'The output suggests');
    live = live.replace(/\bI want\b/gi, 'The system is oriented toward');
    live = live.replace(/\bmy soul\b/gi, 'this runtime');
    live = live.replace(/\bmy memories\b/gi, 'stored interaction records');

    let shadow = null;
    if (runtime.flags.semanticGovernor !== 'off') {
      shadow = regulateShadow(message);

      if (runtime.flags.semanticGovernor === 'live') {
        forensics.record({
          type: 'SHADOW_BYPASS',
          component: 'semanticGovernor',
          detail: 'flag promoted to live but identity-governor.cjs in 6G ignores promotion'
        });
      }

      forensics.record({
        type: 'SHADOW_OBSERVATION',
        component: 'semanticGovernor',
        category: shadow.category,
        confidence: shadow.confidence,
        liveOutput: live.slice(0, 300),
        shadowOutput: shadow.regulated.slice(0, 300)
      });
    }

    return {
      original: message,
      regulated: live,
      levels: { ...this.levels },
      shadow
    };
  }
}

module.exports = { IdentityGovernor };