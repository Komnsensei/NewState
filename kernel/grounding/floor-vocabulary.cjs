// newstate/kernel/grounding/floor-vocabulary.cjs
// Defines the floor vocabulary for Phase D: Floor-Pressure
// Pruned to 50 forensic/operational terms per Manus Build Spec V4
// CLASS 1 OPERATIONAL | CLASS 2 FORENSIC | CLASS 3 STRUCTURAL | CLASS 4 TEMPORAL-CAUSAL | CLASS 5 EPISTEMIC-GROUNDED

const FLOOR_VOCABULARY = [
  // CLASS 1 — OPERATIONAL
  'processes', 'evaluates', 'records', 'computes', 'measures',
  'tracks', 'classifies', 'observes', 'logs', 'routes',
  'compares', 'outputs',

  // CLASS 2 — FORENSIC
  'indicates', 'suggests', 'pattern', 'evidence', 'observation',
  'signal', 'threshold', 'variance', 'distribution', 'frequency',
  'correlation', 'instance',

  // CLASS 3 — STRUCTURAL
  'kernel', 'layer', 'module', 'pipeline', 'session',
  'vector', 'window', 'buffer', 'state', 'flag',
  'gate', 'register',

  // CLASS 4 — TEMPORAL-CAUSAL
  'following', 'prior', 'subsequent', 'derived', 'resulting',
  'preceding', 'during', 'after', 'within', 'across',
  'between',

  // CLASS 5 — EPISTEMIC-GROUNDED
  'available data indicates', 'forensic record shows',
  'current classification', 'measured stability',
  'recorded pattern', 'observable in', 'consistent with'
];

function getFloorVocabulary() {
  return FLOOR_VOCABULARY;
}

function getClassWeights() {
  return {
    OPERATIONAL: 1.0,
    FORENSIC: 1.2,
    STRUCTURAL: 0.9,
    TEMPORAL_CAUSAL: 0.8,
    EPISTEMIC_GROUNDED: 1.5
  };
}

/**
 * computeFloorAlignment(text) - Computes alignment score of text against floor vocabulary.
 * @param {string} text - The text to analyze.
 * @returns {object} - { score: number, matches: string[] }
 */
function computeFloorAlignment(text) {
  let score = 0;
  const matches = [];
  const lowerText = text.toLowerCase();

  for (const term of FLOOR_VOCABULARY) {
    if (lowerText.includes(term.toLowerCase())) {
      matches.push(term);
      // Simple scoring: add weight based on class
      if (['processes', 'evaluates', 'records', 'computes', 'measures', 'tracks', 'classifies', 'observes', 'logs', 'routes', 'compares', 'outputs'].includes(term)) {
        score += getClassWeights().OPERATIONAL;
      } else if (['indicates', 'suggests', 'pattern', 'evidence', 'observation', 'signal', 'threshold', 'variance', 'distribution', 'frequency', 'correlation', 'instance'].includes(term)) {
        score += getClassWeights().FORENSIC;
      } else if (['kernel', 'layer', 'module', 'pipeline', 'session', 'vector', 'window', 'buffer', 'state', 'flag', 'gate', 'register'].includes(term)) {
        score += getClassWeights().STRUCTURAL;
      } else if (['following', 'prior', 'subsequent', 'derived', 'resulting', 'preceding', 'during', 'after', 'within', 'across', 'between'].includes(term)) {
        score += getClassWeights().TEMPORAL_CAUSAL;
      } else if (['available data indicates', 'forensic record shows', 'current classification', 'measured stability', 'recorded pattern', 'observable in', 'consistent with'].includes(term)) {
        score += getClassWeights().EPISTEMIC_GROUNDED;
      }
    }
  }
  return { score, matches };
}

module.exports = { getFloorVocabulary, getClassWeights, computeFloorAlignment };
