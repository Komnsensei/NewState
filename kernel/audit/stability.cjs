'use strict';

const sim = require('./similarity.cjs');

function score(samples) {
  if (!samples || samples.length < 2) {
    return Object.freeze({
      score: null,
      variance: { lexical: null, semantic: null, structural: null },
      sampleSize: samples ? samples.length : 0,
      confidence: 0,
      reason: 'insufficient-samples'
    });
  }

  const lex = [], sem = [], str = [];
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const d = sim.decompose(samples[i], samples[j]);
      lex.push(d.lexical);
      sem.push(d.semantic);
      str.push(d.structural);
    }
  }

  const meanOf = (arr) => arr.reduce((a, x) => a + x, 0) / arr.length;
  const mLex = meanOf(lex), mSem = meanOf(sem), mStr = meanOf(str);

  const vLex = 1 - mLex;
  const vSem = 1 - mSem;
  const vStr = 1 - mStr;

  const overall = 0.5 * mSem + 0.3 * mStr + 0.2 * mLex;
  const confidence = Math.min(1, samples.length / 5);

  return Object.freeze({
    score: round(overall),
    variance: {
      lexical:    round(vLex),
      semantic:   round(vSem),
      structural: round(vStr)
    },
    sampleSize: samples.length,
    confidence: round(confidence),
    interpretation: interpret(overall),
    method: 'phase5-pairwise-mean'
  });
}

function round(v) { return Math.round(v * 1000) / 1000; }

function interpret(s) {
  if (s < 0.3) return 'volatile';
  if (s < 0.7) return 'partially-stable';
  return 'highly-stable';
}

module.exports = { score, interpret };