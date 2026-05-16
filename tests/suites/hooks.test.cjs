'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('invocation hooks', async () => {
    delete require.cache[require.resolve('../../model/invocation-hooks.cjs')];
    const { HookRegistry } = require('../../model/invocation-hooks.cjs');
    const h = new HookRegistry();

    await test('returns payload when no handlers', async () => {
      const r = await h.run('beforePrompt', 'pp');
      eq(r, 'pp');
    });

    await test('handler can transform payload', async () => {
      h.on('beforePrompt', (p) => p + '!');
      const r = await h.run('beforePrompt', 'pp');
      eq(r, 'pp!');
    });

    await test('throws on unknown hook name', () => {
      let threw = false;
      try { h.on('nope', () => {}); } catch (_) { threw = true; }
      assert(threw);
    });

    await test('handler error does not abort chain', async () => {
      h.clear('afterResponse');
      h.on('afterResponse', () => { throw new Error('boom'); });
      h.on('afterResponse', (p) => p + '2');
      const r = await h.run('afterResponse', 'x');
      eq(r, 'x2');
    });
  });
};