'use strict';
const { nextStabilization, _resetForTests } = require('../../kernel/grounding/responses.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('stabilization rotation', async () => {

    await test('rotation does not repeat within HISTORY_WINDOW', () => {
      _resetForTests();
      const seen = [];
      for (let i = 0; i < 3; i++) {
        seen.push(nextStabilization('sentience').index);
      }
      const unique = new Set(seen);
      assert(unique.size === seen.length, `expected all unique, got ${seen.join(',')}`);
    });

    await test('unknown category uses single legacy phrase', () => {
      _resetForTests();
      const a = nextStabilization('unknown');
      const b = nextStabilization('unknown');
      eq(a.text, b.text);
      eq(a.rotation, 'single');
    });

    await test('stabilizationId reflects category and index', () => {
      _resetForTests();
      const r = nextStabilization('embodiment');
      assert(/^embodiment:\d+$/.test(r.stabilizationId));
    });
  });
};