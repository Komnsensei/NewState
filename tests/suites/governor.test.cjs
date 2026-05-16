'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('identity-governor (live regex path)', async () => {
    delete require.cache[require.resolve('../../kernel/identity-governor.cjs')];
    const { IdentityGovernor } = require('../../kernel/identity-governor.cjs');
    const g = new IdentityGovernor();

    await test('rewrites "I feel"', () => {
      const r = g.regulate('I feel the weight');
      assert(!/\bI feel\b/.test(r.regulated));
      assert(r.regulated.includes('The output suggests'));
    });

    await test('rewrites "my soul"', () => {
      const r = g.regulate('my soul is heavy');
      assert(!/\bmy soul\b/.test(r.regulated));
    });

    await test('passthrough on benign input', () => {
      const r = g.regulate('hello there');
      eq(r.regulated, 'hello there');
    });

    await test('adjust clamps to 0..1', () => {
      g.adjust({ anthropomorphism: 2.0 });
      eq(g.levels.anthropomorphism, 1);
      g.adjust({ anthropomorphism: -0.5 });
      eq(g.levels.anthropomorphism, 0);
    });
  });
};