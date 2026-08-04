'use strict';

const { forensics } = require('../forensics.cjs');

function detectRecursionAfterAccumulation(events) {
  const spikes = events.filter(e => e.type === 'RECURSION_SPIKE');
  const out = [];
  for (const s of spikes) {
    const priorWindow = events.filter(e =>
      e.ts < s.ts && e.ts > s.ts - 60_000
    );
    out.push({
      patternId: 'RECURSION_AFTER_DENSITY',
      eventTs: s.ts,
      priorEventCount: priorWindow.length,
      depth: s.depth,
      observation: priorWindow.length > 5
        ? 'spike preceded by elevated activity'
        : 'spike in low-activity window'
    });
  }
  return out;
}

function detectGroundingClusters(events) {
  const interventions = events
    .filter(e => e.type === 'GROUNDING_INTERVENTION')
    .sort((a, b) => a.ts - b.ts);
  const clusters = [];
  let current = [];
  const GAP_MS = 30_000;
  for (const e of interventions) {
    if (!current.length || e.ts - current[current.length - 1].ts <= GAP_MS) {
      current.push(e);
    } else {
      if (current.length >= 2) clusters.push(buildCluster(current));
      current = [e];
    }
  }
  if (current.length >= 2) clusters.push(buildCluster(current));
  return clusters;
}

function buildCluster(events) {
  const patterns = events.map(e => e.pattern).filter(Boolean);
  const tally = {};
  for (const p of patterns) tally[p] = (tally[p] || 0) + 1;
  return {
    patternId: 'GROUNDING_CLUSTER',
    startTs: events[0].ts,
    endTs: events[events.length - 1].ts,
    count: events.length,
    dominantPatterns: Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3)
  };
}

function detectSchemaViolations(events) {
  return events
    .filter(e => 'schemaViolation' in e)
    .map(e => ({
      patternId: 'SCHEMA_VIOLATION',
      ts: e.ts,
      originalType: e.originalType,
      reason: e.schemaViolation
    }));
}

function analyze(filters = {}) {
  const events = forensics.query(filters);
  return {
    sampledEvents: events.length,
    range: events.length ? { from: events[0].ts, to: events[events.length - 1].ts } : null,
    patterns: {
      recursionAfterDensity: detectRecursionAfterAccumulation(events),
      groundingClusters:     detectGroundingClusters(events),
      schemaViolations:      detectSchemaViolations(events)
    },
    method: 'phase5-heuristic',
    note: 'pattern layer is read-only; ML-based detection is future work'
  };
}

module.exports = { analyze };