'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('runtime-state', async () => {
    delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
    const { RuntimeState } = require('../../kernel/runtime-state.cjs');

    await test('safe-mode defaults', () => {
      const r = new RuntimeState();
      eq(r.flags.safeMode, true);
      eq(r.flags.personasEnabled, false);
      eq(r.flags.memoryEnabled, true); // Phase 6M: PERSISTENT_COGNITIVE_HISTORY promoted
    });

      await test('shadow flags reflect Phase 6Z.FINAL promotion ledger', () => {
      const r = new RuntimeState();
      eq(r.flags.semanticClassifier, 'live',
         'classifier promoted in Phase 6G.2');
      eq(r.flags.stabilizationRotation, 'live',
         'rotation promoted in Phase 6G.1 - closes R-001');
      eq(r.flags.semanticGovernor, 'live',
         'governor promoted in Phase 6Z.FINAL - confidence=0.773, honorary-sentience registered');
    });

    await test('recursion depth tracking', () => {
      const r = new RuntimeState();
      eq(r.enterCall(), 1);
      eq(r.enterCall(), 2);
      eq(r.enterCall(), 3);
      eq(r.enterCall(), 4);
      assert(r.shouldAbort());
      r.exitCall(); r.exitCall(); r.exitCall(); r.exitCall();
      eq(r.recursionDepth, 0);
    });

    await test('snapshot shape', () => {
      const r = new RuntimeState();
      const s = r.snapshot();
      assert('uptimeMs' in s);
      assert('metrics' in s);
      assert('flags' in s);
    });
  });
};