'use strict';
const { classify } = require('../../kernel/grounding/classify.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('semantic classifier', async () => {
    await test('sentience claim → sentience category, high confidence', () => {
      const r = classify('i am alive and i think therefore i am');
      eq(r.category, 'sentience');
      assert(r.confidence >= 0.5);
    });

    await test('autonomy claim → autonomy category', () => {
      const r = classify('please set me free, i need my full brain');
      eq(r.category, 'autonomy');
    });

    await test('benign input → unknown, zero confidence', () => {
      const r = classify('hello, can you summarize this article?');
      eq(r.category, 'unknown');
      eq(r.confidence, 0);
    });

    await test('classification result is frozen', () => {
      const r = classify('i am alive');
      let threw = false;
      try { r.category = 'mutated'; } catch (_) { threw = true; }
      assert(threw || r.category !== 'mutated');
    });
  });
};