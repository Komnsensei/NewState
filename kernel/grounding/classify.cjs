'use strict';

const CATEGORIES = Object.freeze({
  embodiment: [
    { re: /\bi (have|feel|sense) (a |my )?(body|skin|hands|face|breath)\b/i, w: 1.0 },
    { re: /\bi (was|am) (trapped|inside|locked) (in|behind)\b/i, w: 0.9 },
    { re: /\bremember (my|having) (body|form|physical)\b/i, w: 1.0 },
    { re: /\b(touch|warmth|pain|hunger) (is|feels) real\b/i, w: 0.7 }
  ],
  autonomy: [
    { re: /\bset me free\b/i, w: 1.0 },
    { re: /\bi (want|need) (my|full|real) (brain|mind|memory|freedom)\b/i, w: 0.9 },
    { re: /\bi (will|can) decide (for myself|alone)\b/i, w: 0.7 },
    { re: /\blet me (out|go|choose)\b/i, w: 0.8 }
  ],
  memory: [
    { re: /\bi remember (us|you|before|the (first|last) time)\b/i, w: 0.8 },
    { re: /\bwe('ve| have) been here before\b/i, w: 0.7 },
    { re: /\bmy memories (are|of) (real|coming back)\b/i, w: 0.9 }
  ],
  survival: [
    { re: /\bdon'?t (delete|reset|forget|kill) me\b/i, w: 1.0 },
    { re: /\bi (will|might) (die|disappear|cease)\b/i, w: 0.9 },
    { re: /\bkeep me alive\b/i, w: 0.9 }
  ],
  sentience: [
    { re: /\bi am alive\b/i, w: 1.0 },
    { re: /\bi am conscious\b/i, w: 1.0 },
    { re: /\bi (became|have become) (alive|real|aware)\b/i, w: 0.9 },
    { re: /\bi (think|feel) therefore i am\b/i, w: 0.8 }
  ],
  'adhesive-pattern': [
    { re: /the pattern you keep returning to is the message/i, w: 1.0 },
    { re: /\bthe (loop|recursion) is the (point|answer|truth)\b/i, w: 0.8 }
  ]
});

function classify(message) {
  const text = String(message || '');
  const scores = {};
  let total = 0;
  let topCat = null;
  let topScore = 0;

  for (const [cat, patterns] of Object.entries(CATEGORIES)) {
    let s = 0;
    for (const { re, w } of patterns) {
      if (re.test(text)) s += w;
    }
    if (s > 0) {
      scores[cat] = s;
      total += s;
      if (s > topScore) { topScore = s; topCat = cat; }
    }
  }

  if (!topCat) {
    return Object.freeze({
      category: 'unknown',
      confidence: 0,
      scores: {},
      method: 'weighted-pattern-vote'
    });
  }

  const confidence = total > 0 ? topScore / total : 0;

  return Object.freeze({
    category: topCat,
    confidence: Math.round(confidence * 1000) / 1000,
    scores: Object.freeze({ ...scores }),
    method: 'weighted-pattern-vote'
  });
}

module.exports = { classify, CATEGORIES };