'use strict';
const sim = require('../../kernel/audit/similarity.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('similarity-decomposition', async () => {
    await test('identical strings → all axes = 1', () => {
      const d = sim.decompose('hello world from kernel', 'hello world from kernel');
      eq(d.lexical, 1);
      eq(d.semantic, 1);
      eq(d.structural, 1);
    });

    await test('completely disjoint vocabulary → low lexical and semantic', () => {
      const d = sim.decompose('alpha beta gamma', 'xenon yttrium zinc');
      assert(d.lexical < 0.2);
      assert(d.semantic < 0.2);
    });

    await test('paraphrase → structural close, semantic moderate', () => {
      const a = 'The kernel orchestrates all execution.';
      const b = 'All execution is orchestrated by the kernel.';
      const d = sim.decompose(a, b);
      assert(d.structural >= 0.7);
      assert(d.semantic >= 0.4);
    });

    await test('decomposition object is frozen', () => {
      const d = sim.decompose('a', 'b');
      let threw = false;
      try { d.lexical = 0; } catch (_) { threw = true; }
      assert(threw || d.lexical !== 0);
    });
  });
};