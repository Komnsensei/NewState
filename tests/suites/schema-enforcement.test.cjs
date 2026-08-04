'use strict';
const { validate } = require('../../kernel/schemas/event-schemas.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('schema enforcement', async () => {
    await test('valid event passes', () => {
      const r = validate({ ts: 1, type: 'RECURSION_SPIKE', depth: 2 });
      eq(r.ok, true);
    });

    await test('missing required field fails with reason', () => {
      const r = validate({ ts: 1, type: 'RECURSION_SPIKE' });
      eq(r.ok, false);
      assert(/missing:depth/.test(r.reason));
    });

    await test('unknown type fails with reason', () => {
      const r = validate({ ts: 1, type: 'NOPE' });
      eq(r.ok, false);
      eq(r.reason, 'unknown-type');
    });
  });
};