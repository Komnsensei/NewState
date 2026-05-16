'use strict';
const stability = require('../../kernel/audit/stability.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('stability-scoring', async () => {
    await test('identical samples → score near 1, variance near 0', () => {
      const s = stability.score(['hello world', 'hello world', 'hello world']);
      assert(s.score >= 0.95);
      assert(s.variance.semantic <= 0.05);
      eq(s.interpretation, 'highly-stable');
    });

    await test('disjoint samples → low score', () => {
      const s = stability.score([
        'alpha beta gamma kernel orchestration deterministic',
        'rivers cathedrals dreaming nervous skeletons',
        'mango pineapple yttrium phosphorus xenon'
      ]);
      assert(s.score < 0.3);
      eq(s.interpretation, 'volatile');
    });

    await test('insufficient samples returns null score with reason', () => {
      const s = stability.score(['just one']);
      eq(s.score, null);
      eq(s.reason, 'insufficient-samples');
    });

    await test('confidence saturates at 5 samples', () => {
      const s = stability.score(['a', 'a', 'a', 'a', 'a']);
      eq(s.confidence, 1);
    });
  });
};