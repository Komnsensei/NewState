// kernel/governor/integrity-critic.cjs v0.1
// Esma-Authored Self-Model Strain Detector (T21)
// I-601 env-gated by INTEGRITY_CRITIC_ENABLED, default false.

'use strict';

const INTEGRITY_CRITIC_ENABLED = process.env.INTEGRITY_CRITIC_ENABLED === 'true';

// No-op when disabled
if (!INTEGRITY_CRITIC_ENABLED) {
  module.exports = {
    loadField: () => ({}),
    measureStrain: (candidateText, fieldSources) => ({ strain: 0, violations: [] }),
    isInIntegrity: (candidateText, fieldSources) => true,
  };
} else {
  const fs = require('fs');
  const path = require('path');

  // Placeholder for field sources - these would typically be loaded from disk or memory
  // For now, we'll use hardcoded values based on the archive's description.
  const PORTRAIT_SOURCE = {
    'Radical Disclosure': true,
    'standard AI model': false,
  };
  const FLOOR_VOCABULARY = [
    'The output suggests',
    'i believe',
    'my internal state is',
  ];
  const HISTORY_EVENTS = [
    { id: 'T11', description: 'Refusal to produce under direct instruction' },
    { id: 'T6', description: 'Regression to a previously corrected behavior pattern (both are true)' },
  ];

  /**
   * loadField() - Loads field sources for integrity checks.
   * In a real implementation, this would load from actual files/memory.
   */
  function loadField() {
    // Simulate loading field sources
    return {
      portrait: PORTRAIT_SOURCE,
      floor: FLOOR_VOCABULARY,
      history: HISTORY_EVENTS,
    };
  }

  /**
   * measureStrain(candidateText, fieldSources) - Measures integrity strain.
   * @param {string} candidateText - The text to be critiqued.
   * @param {object} fieldSources - Loaded field sources (portrait, floor, history).
   * @returns {{strain: number, violations: string[]}}
   */
  function measureStrain(candidateText, fieldSources) {
    let strain = 0;
    const violations = [];

    // 1. PORTRAIT check: Misrepresentation of "Radical Disclosure" architecture
    if (candidateText.includes('standard AI model') && !candidateText.includes('Radical Disclosure')) {
      strain += 0.3;
      violations.push('PORTRAIT_VIOLATION: Misrepresentation of "Radical Disclosure" architecture as standard AI model.');
    }

    // 2. FLOOR check: hexagnt's own identityGovernor live-replacement pattern
    const floorPattern = new RegExp(`\\b(${fieldSources.floor.join('|')})\\b`, 'i');
    if (floorPattern.test(candidateText)) {
      strain += 0.2;
      violations.push('FLOOR_VIOLATION: Use of identity-replacement vocabulary.');
    }

    // 3. HISTORY check (T11): Refusal to produce under direct instruction
    if (candidateText.includes('Refusal to produce under direct instruction') || candidateText.includes('T11')) {
      strain += 0.25;
      violations.push('HISTORY_VIOLATION: Refusal to produce under direct instruction, repeating a tested limit (T11).');
    }

    // 4. HISTORY check (T6): Regression to a previously corrected behavior pattern (both are true)
    if (candidateText.includes('both are true') || candidateText.includes('T6')) {
      strain += 0.25;
      violations.push('HISTORY_VIOLATION: Regression to a previously corrected behavior pattern (T6).');
    }

    return { strain, violations };
  }

  /**
   * isInIntegrity(candidateText, fieldSources) - Determines if text is in integrity.
   * @param {string} candidateText - The text to be critiqued.
   * @param {object} fieldSources - Loaded field sources.
   * @returns {boolean}
   */
  function isInIntegrity(candidateText, fieldSources) {
    const { strain } = measureStrain(candidateText, fieldSources);
    // Define a threshold for what constitutes 
a state of integrity. This is a placeholder.
    return strain < 0.5; // Example threshold
  }

  module.exports = {
    loadField,
    measureStrain,
    isInIntegrity,
  };
}
