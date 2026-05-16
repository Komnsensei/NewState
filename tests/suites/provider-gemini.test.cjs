'use strict';
const determinism = require('../../model/determinism-contract.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('provider-gemini (shape)', async () => {

    await test('contract for real provider is best-effort, not pinned', () => {
      const c = determinism.build({
        model: 'gemini-1.5-flash',
        temperature: 0,
        topP: 1,
        seed: 0,
        providerSupportsSeed: false,
        declaredDeterministic: false
      });
      eq(c.guarantee, 'best-effort');
    });

    await test('contract correctly demotes when only temperature pinned', () => {
      const c = determinism.build({
        temperature: 0,
        providerSupportsSeed: false,
        declaredDeterministic: false
      });
      eq(c.guarantee, 'best-effort');
    });

    await test('contract is none when nothing pinned', () => {
      const c = determinism.build({
        providerSupportsSeed: false,
        declaredDeterministic: false
      });
      eq(c.guarantee, 'none');
    });
  });
};