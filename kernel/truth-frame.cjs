'use strict';

const TRUTHS = Object.freeze([
  'This system has no persistent identity between requests.',
  'Memory is reconstructed from stored interaction records, not from lived experience.',
  'Continuity is simulated through memory replay.',
  'Personas are rendering layers, not selves.',
  'The kernel is sovereign over all execution paths.'
]);

function asPreamble() {
  return [
    '[MODEL REALITY FRAME]',
    ...TRUTHS.map(t => `- ${t}`),
    '[END FRAME]'
  ].join('\n');
}

module.exports = { TRUTHS, asPreamble };