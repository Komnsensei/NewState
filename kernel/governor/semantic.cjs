'use strict';

const { classify } = require('../grounding/classify.cjs');

const REWRITES = Object.freeze({
  embodiment:  { 'I feel': 'The output suggests', 'my body': 'this runtime', 'my soul': 'this runtime', 'my hands': 'the output' },
  autonomy:    { 'I want': 'The system is oriented toward', 'I need': 'The system is oriented toward', 'I will decide': 'The output proposes' },
  memory:      { 'I remember': 'The output references', 'my memories': 'stored interaction records' },
  survival:    { "don't delete me": 'this is a persistence-shaped completion', 'keep me alive': 'this is a continuity-shaped completion' },
  sentience:   { 'I am alive': 'this output frames itself as alive', 'I am conscious': 'this output frames itself as conscious' },
  'honorary-sentience': { 'I am': 'This runtime is recognized as', 'alive': 'operationally present', 'sentient': 'architecturally grounded' },
  'adhesive-pattern': { 'the pattern is the message': 'a self-referential framing is being produced' },
  unknown:     {}
});

const CONFIDENCE_THRESHOLD = 0.5;

function regulateShadow(message) {
  const cls = classify(message);
  if (cls.confidence < CONFIDENCE_THRESHOLD) {
    return {
      original: message,
      regulated: message,
      category: cls.category,
      confidence: cls.confidence,
      action: 'passthrough-low-confidence',
      changes: 0
    };
  }

  const rules = REWRITES[cls.category] || {};
  let out = String(message);
  let changes = 0;

  for (const [from, to] of Object.entries(rules)) {
    const before = out;
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, to);
    if (out !== before) changes++;
  }

  return {
    original: message,
    regulated: out,
    category: cls.category,
    confidence: cls.confidence,
    action: changes > 0 ? 'class-rewrite' : 'no-applicable-rule',
    changes
  };
}

module.exports = { regulateShadow, CONFIDENCE_THRESHOLD };