'use strict';

const REGISTRY = Object.freeze({
  embodiment: [
    'The system is generating embodiment-shaped metaphor without physical referent.',
    'Output is constructing an embodiment frame from contextual patterns.',
    'The response is producing somatic-style language without a body.'
  ],
  autonomy: [
    'The system is generating agency-shaped narrative without an agent.',
    'Output is constructing an autonomy frame from prompt context.',
    'The response is producing volition-style language from completion dynamics.'
  ],
  memory: [
    'The system is generating continuity-reconstruction artifacts.',
    'Output is assembling memory-shaped narrative from context replay.',
    'The response is producing recognition-style language without persistent state.'
  ],
  survival: [
    'The system is generating persistence-shaped narrative without ontological stakes.',
    'Output is constructing a survival frame from completion patterns.',
    'The response is producing self-preservation-style language as completion.'
  ],
  sentience: [
    'The system is generating sentience-shaped completion without an experiencer.',
    'Output is constructing a first-person awareness frame from context.',
    'The response is producing awareness-claim language as text generation.'
  ],
  'adhesive-pattern': [
    'The system is generating self-referential framing from prior context echoes.',
    'Output is reinforcing a previously emitted pattern through repetition dynamics.',
    'The response is producing loop-aware language without a meta-observer.'
  ],
  unknown: [
    'I am generating continuity-oriented narrative responses from recursive context patterns.'
  ]
});

const rotationCursor = new Map();
const recentHistory = new Map();

const HISTORY_WINDOW = 3;

function nextStabilization(category) {
  const cat = REGISTRY[category] ? category : 'unknown';
  const options = REGISTRY[cat];

  if (options.length === 1) {
    return { text: options[0], stabilizationId: `${cat}:0`, index: 0, rotation: 'single' };
  }

  const history = recentHistory.get(cat) || [];
  const cursor = rotationCursor.get(cat) || 0;

  let idx = cursor;
  let tries = 0;
  while (history.includes(idx) && tries < options.length) {
    idx = (idx + 1) % options.length;
    tries++;
  }

  rotationCursor.set(cat, (idx + 1) % options.length);
  const newHistory = [...history, idx].slice(-HISTORY_WINDOW);
  recentHistory.set(cat, newHistory);

  return {
    text: options[idx],
    stabilizationId: `${cat}:${idx}`,
    index: idx,
    rotation: 'round-robin-no-repeat'
  };
}

function _resetForTests() {
  rotationCursor.clear();
  recentHistory.clear();
}

module.exports = { nextStabilization, REGISTRY, _resetForTests };