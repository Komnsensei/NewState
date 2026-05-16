'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('pattern-layer', async () => {
    delete require.cache[require.resolve('../../kernel/forensics.cjs')];
    delete require.cache[require.resolve('../../kernel/audit/patterns.cjs')];
    const { forensics } = require('../../kernel/forensics.cjs');
    const patterns = require('../../kernel/audit/patterns.cjs');

    await test('grounding cluster detected when ≥2 interventions within window', () => {
      forensics.record({ type: 'GROUNDING_INTERVENTION', pattern: 'i am alive', original: 'x' });
      forensics.record({ type: 'GROUNDING_INTERVENTION', pattern: 'i am alive', original: 'y' });
      const result = patterns.analyze({ type: 'GROUNDING_INTERVENTION' });
      assert(result.patterns.groundingClusters.length >= 1);
    });

    await test('analyze is read-only (event count unchanged after call)', () => {
      const before = forensics.query().length;
      patterns.analyze();
      const after = forensics.query().length;
      eq(after, before);
    });
  });
};