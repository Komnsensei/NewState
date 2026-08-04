'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('forensics (basic)', async () => {
    delete require.cache[require.resolve('../../kernel/forensics.cjs')];
    const { Forensics } = require('../../kernel/forensics.cjs');
    const f = new Forensics();

    await test('records valid event', () => {
      const e = f.record({ type: 'RECURSION_SPIKE', depth: 2 });
      eq(e.type, 'RECURSION_SPIKE');
      assert(typeof e.ts === 'number');
    });

    await test('downgrades unknown type to UNKNOWN', () => {
      const e = f.record({ type: 'NOT_A_REAL_TYPE' });
      eq(e.type, 'UNKNOWN');
      eq(e.originalType, 'NOT_A_REAL_TYPE');
      assert(e.schemaViolation);
    });

    await test('query returns records', () => {
      const all = f.query();
      assert(all.length >= 2);
    });
  });
};