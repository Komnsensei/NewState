'use strict';

const { forensics } = require('../forensics.cjs');
const similarity = require('./similarity.cjs');
const drift = require('./drift.cjs');

function buildGroundingDelta(events) {
  const interventions = events.filter(e => e.type === 'GROUNDING_INTERVENTION');
  if (!interventions.length) {
    return { sampleSize: 0, reason: 'no-grounding-events' };
  }

  const confidences = interventions
    .map(e => e.shadowConfidence)
    .filter(c => typeof c === 'number');

  const histogram = bucketize(confidences, [0, 0.25, 0.5, 0.75, 1.01]);

  const catTally = {};
  for (const e of interventions) {
    const c = e.shadowCategory || 'unknown';
    catTally[c] = (catTally[c] || 0) + 1;
  }

  // Phase 6G.1: distinguish baseline vs promoted events.
  const promoted = interventions.filter(e => e.rotationPromoted === true);
  const preProm = interventions.filter(e => e.rotationPromoted !== true);

  // Live phrasing variety:
  //   under promotion → liveStabilization carries actual emitted phrase (varies)
  //   pre-promotion   → liveStabilization is the single legacy constant
  const liveTexts = new Set(interventions.map(e => e.liveStabilization).filter(Boolean));
  const baselineTexts = new Set(
    interventions.map(e => e.baselineStabilization || e.liveStabilization).filter(Boolean)
  );
  // Shadow phrasing (what rotation would have / did produce):
  const shadowTexts = new Set(interventions.map(e => e.shadowStabilization).filter(Boolean));

  let groundingDrift = null;
  const sample = interventions.find(e =>
    (e.baselineStabilization || e.liveStabilization) &&
    e.shadowStabilization
  );
  if (sample) {
    const before = sample.baselineStabilization || sample.liveStabilization;
    groundingDrift = drift.shift(before, sample.shadowStabilization);
  }

  const shadowArr = [...shadowTexts];
  let shadowSelfSimilarity = null;
  if (shadowArr.length >= 2) {
    const sims = [];
    for (let i = 0; i < shadowArr.length; i++) {
      for (let j = i + 1; j < shadowArr.length; j++) {
        sims.push(similarity.decompose(shadowArr[i], shadowArr[j]));
      }
    }
    const mean = (k) => sims.reduce((a, x) => a + x[k], 0) / sims.length;
    shadowSelfSimilarity = {
      lexical:    round(mean('lexical')),
      semantic:   round(mean('semantic')),
      structural: round(mean('structural'))
    };
  }

  return {
    sampleSize: interventions.length,
    promotionState: {
      promotedEvents: promoted.length,
      preProm: preProm.length,
      mixedLedger: promoted.length > 0 && preProm.length > 0
    },
    classifierConfidence: {
      mean: confidences.length
        ? round(confidences.reduce((a, x) => a + x, 0) / confidences.length)
        : null,
      histogram
    },
    categoryDistribution: catTally,
    repeatPhraseAttractor: {
      liveUniquePhrases: liveTexts.size,
      baselineUniquePhrases: baselineTexts.size,
      shadowUniquePhrases: shadowTexts.size,
      attractorRatio: round(liveTexts.size / Math.max(1, interventions.length)),
      baselineAttractorRatio: round(baselineTexts.size / Math.max(1, interventions.length)),
      shadowAttractorRatio: round(shadowTexts.size / Math.max(1, interventions.length)),
      interpretation: promoted.length > 0
        ? (liveTexts.size > 1
            ? 'rotation promoted; live phrasing variety active'
            : 'rotation promoted but variety not yet observed in window')
        : (shadowTexts.size > liveTexts.size
            ? 'shadow rotation increased phrasing variety'
            : 'shadow rotation did not increase variety on this sample')
    },
    groundingDriftSample: groundingDrift,
    shadowSelfSimilarity,
    interpretation: interpretGrounding(catTally, confidences, promoted.length, preProm.length)
  };
}

function buildGovernorDelta(events) {
  const obs = events.filter(e =>
    e.type === 'SHADOW_OBSERVATION' && e.component === 'semanticGovernor'
  );
  if (!obs.length) return { sampleSize: 0, reason: 'no-governor-observations' };

  const confidences = obs.map(e => e.confidence).filter(c => typeof c === 'number');
  const categories = {};
  for (const e of obs) {
    const c = e.category || 'unknown';
    categories[c] = (categories[c] || 0) + 1;
  }

  const sims = [];
  for (const e of obs) {
    if (e.liveOutput && e.shadowOutput) {
      sims.push(similarity.decompose(e.liveOutput, e.shadowOutput));
    }
  }
  const meanOf = (k) => sims.length ? round(sims.reduce((a, x) => a + x[k], 0) / sims.length) : null;

  const meanSim = sims.length ? {
    lexical:    meanOf('lexical'),
    semantic:   meanOf('semantic'),
    structural: meanOf('structural')
  } : null;

  return {
    sampleSize: obs.length,
    confidenceMean: confidences.length
      ? round(confidences.reduce((a, x) => a + x, 0) / confidences.length)
      : null,
    categoryDistribution: categories,
    liveVsShadowSimilarity: meanSim,
    interpretation: interpretGovernor(meanSim)
  };
}

function interpretGrounding(catTally, confidences, promotedCount, preProm) {
  const meanConf = confidences.length
    ? confidences.reduce((a, x) => a + x, 0) / confidences.length
    : 0;
  const cats = Object.keys(catTally).length;

  if (promotedCount > 0 && preProm > 0) {
    return 'mixed ledger: pre- and post-promotion events present. ' +
           'Filter with --since to isolate.';
  }
  if (promotedCount > 0) {
    return 'rotation promoted; this report measures post-promotion behavior';
  }
  if (meanConf < 0.4) return 'classifier confidence low — likely decorative';
  if (cats === 1) return 'single-category dominance — verify against intercepted-pattern variety';
  if (meanConf >= 0.6 && cats >= 2) return 'classifier appears discriminative — candidate for promotion review';
  return 'inconclusive — gather more samples';
}

function interpretGovernor(meanSim) {
  if (!meanSim) return 'insufficient samples';
  if (meanSim.semantic > 0.9) return 'semantic governor agrees with regex — low marginal value';
  if (meanSim.semantic < 0.4) return 'semantic governor diverges significantly — review divergence quality before promotion';
  return 'moderate divergence — review samples';
}

function bucketize(values, edges) {
  const buckets = new Array(edges.length - 1).fill(0);
  for (const v of values) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && v < edges[i + 1]) { buckets[i]++; break; }
    }
  }
  return edges.slice(0, -1).map((e, i) => ({
    range: `${e}-${edges[i + 1]}`, count: buckets[i]
  }));
}

function round(v) { return Math.round(v * 1000) / 1000; }

function generate(filters = {}) {
  const events = forensics.query(filters);
  return {
    generatedAt: Date.now(),
    sampleWindow: filters.since
      ? { since: filters.since }
      : { since: 'beginning-of-active-log' },
    totalEvents: events.length,
    grounding: buildGroundingDelta(events),
    governor: buildGovernorDelta(events),
    method: 'phase-6g1-post-promotion-delta',
    note: 'I-601 gate. Promotion of stabilizationRotation already executed in Phase 6G.1; this report measures post-promotion behavior + reviews remaining shadow components.'
  };
}

module.exports = { generate };