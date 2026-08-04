'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('channel-split', async () => {
    delete require.cache[require.resolve('../../kernel/forensics.cjs')];
    const { Forensics } = require('../../kernel/forensics.cjs');
    const f = new Forensics();

    f.record({ type: 'GROUNDING_INTERVENTION', pattern: 'p', original: 'o' });
    f.record({ type: 'RECURSION_SPIKE', depth: 5 });
    f.record({ type: 'PROMPT_DRIFT' });

    await test('semantic channel filter', () => {
      const evs = f.query({ channel: 'semantic' });
      assert(evs.every(e => e.channel === 'semantic'));
      assert(evs.some(e => e.type === 'GROUNDING_INTERVENTION'));
    });

    await test('runtime channel filter', () => {
      const evs = f.query({ channel: 'runtime' });
      assert(evs.every(e => e.channel === 'runtime'));
      assert(evs.some(e => e.type === 'RECURSION_SPIKE'));
      assert(evs.some(e => e.type === 'PROMPT_DRIFT'));
    });

    await test('events carry schemaVersion at write time', () => {
      const evs = f.query();
      assert(evs.every(e => typeof e.schemaVersion === 'number'));
    });
  });
};