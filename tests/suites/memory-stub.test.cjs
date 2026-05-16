'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('memory stub', async () => {
    delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
    delete require.cache[require.resolve('../../memory/hex-memory.cjs')];
    const { runtime } = require('../../kernel/runtime-state.cjs');
    const { HexMemory } = require('../../memory/hex-memory.cjs');
    const m = new HexMemory();

    await test('retrieve returns empty when disabled', () => {
      runtime.flags.memoryEnabled = false;
      const r = m.retrieve('anything');
      eq(r.packet, '');
      eq(r.facts.length, 0);
    });

    await test('store refuses when disabled', () => {
      runtime.flags.memoryEnabled = false;
      const r = m.store({ id: 'x' });
      eq(r.ok, false);
      eq(r.reason, 'memory-disabled');
    });
  });
};