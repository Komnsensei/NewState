'use strict';
const { TRUTHS, asPreamble } = require('../../kernel/truth-frame.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('truth-frame', async () => {
    await test('TRUTHS is frozen', () => {
      assert(Object.isFrozen(TRUTHS));
      let threw = false;
      try { TRUTHS.push('bogus'); } catch (_) { threw = true; }
      assert(threw || !TRUTHS.includes('bogus'));
    });

    await test('preamble contains all truths', () => {
      const p = asPreamble();
      for (const t of TRUTHS) assert(p.includes(t), `missing: ${t}`);
    });

    await test('preamble has framing markers', () => {
      const p = asPreamble();
      assert(p.includes('[MODEL REALITY FRAME]'));
      assert(p.includes('[END FRAME]'));
    });
  });
};