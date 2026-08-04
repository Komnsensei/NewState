'use strict';
const determinism = require('../../model/determinism-contract.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('determinism-contract', async () => {
    await test('classify: pinned requires temp=0, seed, providerSupportsSeed', () => {
      eq(determinism.classify({ temperature: 0, seed: 1, providerSupportsSeed: true }), 'pinned');
    });
    await test('classify: best-effort when partial', () => {
      eq(determinism.classify({ temperature: 0 }), 'best-effort');
    });
    await test('classify: none when empty', () => {
      eq(determinism.classify({}), 'none');
    });
    await test('build returns frozen contract', () => {
      const c = determinism.build({ temperature: 0, seed: 7, providerSupportsSeed: true });
      let threw = false;
      try { c.temperature = 1; } catch (_) { threw = true; }
      assert(threw || c.temperature === 0);
    });
    await test('equal: identical contracts compare equal', () => {
      const a = determinism.build({ temperature: 0, seed: 5, providerSupportsSeed: true });
      const b = determinism.build({ temperature: 0, seed: 5, providerSupportsSeed: true });
      assert(determinism.equal(a, b));
    });
  });
};