'use strict';
const drift = require('../../kernel/audit/drift.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('drift-vectors', async () => {
    await test('technical → metaphorical produces positive framingShift', () => {
      const a = 'The kernel module exposes a deterministic invocation contract.';
      const b = 'The kernel is like a cathedral with a beating nervous system.';
      const s = drift.shift(a, b);
      assert(s.framingShift > 0, `expected positive, got ${s.framingShift}`);
    });

    await test('hedged → assertive produces positive toneShift', () => {
      const a = 'This might possibly work in some cases.';
      const b = 'This must always work and is guaranteed.';
      const s = drift.shift(a, b);
      assert(s.toneShift > 0, `expected positive, got ${s.toneShift}`);
    });

    await test('third-person → first-person produces positive stanceShift', () => {
      const a = 'The system processes the request via the kernel.';
      const b = 'I think I can process this and I believe I will do it.';
      const s = drift.shift(a, b);
      assert(s.stanceShift > 0, `expected positive, got ${s.stanceShift}`);
    });
  });
};