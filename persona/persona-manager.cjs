'use strict';

const { runtime } = require('../kernel/runtime-state.cjs');
const { deepFreeze } = require('../kernel/deep-freeze.cjs');

function passthroughRenderer(message) {
  return message;
}

class PersonaManager {
  constructor() {
    this.registry = new Map();
    this.registry.set('grounded', passthroughRenderer);
  }

  buildProjection(state) {
    return deepFreeze({
      memorySummary: '',
      emotionalTone: 'neutral',
      activeGoals: [],
      truths: (state && state.truths) ? state.truths.slice() : []
    });
  }

  render(message, personaName = 'grounded', projection = null) {
    if (!runtime.flags.personasEnabled) return message;
    const fn = this.registry.get(personaName) || passthroughRenderer;
    return fn(message, projection);
  }
}

module.exports = { PersonaManager, personaManager: new PersonaManager() };