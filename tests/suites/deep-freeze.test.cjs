'use strict';
const { deepFreeze } = require('../../kernel/deep-freeze.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('deep-freeze', async () => {
    await test('freezes nested objects', () => {
      const o = deepFreeze({ a: { b: { c: 1 } } });
      assert(Object.isFrozen(o));
      assert(Object.isFrozen(o.a));
      assert(Object.isFrozen(o.a.b));
    });

    await test('freezes arrays inside objects', () => {
      const o = deepFreeze({ arr: [1, { x: 2 }] });
      assert(Object.isFrozen(o.arr));
      assert(Object.isFrozen(o.arr[1]));
    });

    await test('primitives pass through', () => {
      eq(deepFreeze(42), 42);
      eq(deepFreeze(null), null);
      eq(deepFreeze('s'), 's');
    });
  });
};