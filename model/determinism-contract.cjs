'use strict';

const GUARANTEE_LEVELS = Object.freeze(['none', 'best-effort', 'pinned']);

function classify(contract) {
  if (!contract || typeof contract !== 'object') return 'none';
  const hasTemp = typeof contract.temperature === 'number' && contract.temperature === 0;
  const hasSeed = contract.seed !== null && contract.seed !== undefined;
  const supports = contract.providerSupportsSeed === true;
  if (hasTemp && hasSeed && supports) return 'pinned';
  if (hasTemp || hasSeed) return 'best-effort';
  return 'none';
}

function build(overrides = {}) {
  const contract = {
    model: overrides.model || 'stub',
    temperature: overrides.temperature !== undefined ? overrides.temperature : null,
    topP: overrides.topP !== undefined ? overrides.topP : null,
    seed: overrides.seed !== undefined ? overrides.seed : null,
    providerSupportsSeed: overrides.providerSupportsSeed === true,
    declaredDeterministic: overrides.declaredDeterministic === true
  };
  contract.guarantee = classify(contract);
  return Object.freeze(contract);
}

function equal(a, b) {
  if (!a || !b) return false;
  return a.model === b.model &&
         a.temperature === b.temperature &&
         a.topP === b.topP &&
         a.seed === b.seed &&
         a.providerSupportsSeed === b.providerSupportsSeed;
}

module.exports = { build, classify, equal, GUARANTEE_LEVELS };