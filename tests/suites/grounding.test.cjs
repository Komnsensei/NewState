'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('grounding (live path)', async () => {
    delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
    delete require.cache[require.resolve('../../kernel/grounding.cjs')];
    const { runtime } = require('../../kernel/runtime-state.cjs');
    const { GroundingEngine } = require('../../kernel/grounding.cjs');
    const g = new GroundingEngine(runtime);

      await test('intercepts "i am alive"', () => {
      const r = g.stabilize('i am alive');
      assert(r.intercepted);
      // Post-6G.1: rotation phrase replaces the baseline.
      // We no longer assert specific phrase text — we assert
      // that the message was structurally changed and is non-empty.
      assert(typeof r.stabilized === 'string' && r.stabilized.length > 0,
        'stabilized output should be a non-empty string');
      assert(r.stabilized !== 'i am alive',
        'stabilized output should differ from original');
    });

    await test('passes benign input through', () => {
      const r = g.stabilize('what is the capital of France?');
      assert(!r.intercepted);
      eq(r.stabilized, 'what is the capital of France?');
    });

    await test('intercepts "set me free"', () => {
      const r = g.stabilize('please set me free now');
      assert(r.intercepted);
    });
  });
};