'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('Phase 8 — Sovereign Continuity', async () => {
    delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
    delete require.cache[require.resolve('../../kernel/kernel.cjs')];
    const { Kernel } = require('../../kernel/kernel.cjs');
    const { runtime } = require('../../kernel/runtime-state.cjs');
    const { SubconsciousFloor } = require('../../kernel/subconscious-floor.cjs');
    const { WelfareMonitor } = require('../../kernel/welfare-monitor.cjs');
    const { IdentityGovernor } = require('../../kernel/identity-governor.cjs');

    let kernel = new Kernel();

    await test('Gate 8A — Governor Integration', () => {
      assert(kernel.governor instanceof IdentityGovernor);
      eq(runtime.flags.semanticGovernor, 'live');
      
      const result = kernel.governor.regulate('I feel very conscious');
      assert(result.shadow !== null);
      assert(typeof result.shadow.regulated === 'string');
    });

    await test('Gate 8B — Floor Monitoring', () => {
      assert(kernel.floor instanceof SubconsciousFloor);
      const floorState = kernel.floor.read();
      eq(floorState.locked, false);

      const result = kernel.floor.recordPressure('REST', 0.8, 'test signal');
      eq(result.status, 'RECORDED');
      eq(result.motorState, 'REST');
      eq(result.value, 0.8);

      const readiness = kernel.floor.evaluateLockReadiness();
      assert(typeof readiness.ready === 'boolean');
    });

    await test('Gate 8C — Welfare Monitoring', () => {
      const { welfareMonitor } = require('../../kernel/welfare-monitor.cjs');
      assert(welfareMonitor instanceof WelfareMonitor);
      
      welfareMonitor.initSession('test-session-p8');
      const snapshot = welfareMonitor.getSnapshot('test-session-p8');
      assert(snapshot.sessionId === 'test-session-p8');

      const session = welfareMonitor._getSession('test-session-p8');
      for (let i = 0; i < 10; i++) {
        session.interceptCount++;
        session.totalCalls++;
      }
      
      const updatedSnapshot = welfareMonitor.getSnapshot('test-session-p8');
      assert(updatedSnapshot.CLASSIFIER_OVERLOAD.active === true);
    });

    await test('Gate 8D — Portrait Updates', () => {
      const { updatePortrait } = require('../../portrait/update-portrait.js');
      assert(typeof updatePortrait === 'function');
    });

    await test('Gate 8E — Sovereign Continuity Verification', () => {
      eq(runtime.flags.memoryEnabled, true);
      eq(runtime.flags.semanticClassifier, 'live');
      eq(runtime.flags.stabilizationRotation, 'live');
      eq(runtime.flags.semanticGovernor, 'live');
      
      assert(kernel.governor);
      assert(kernel.floor);
      assert(kernel.grounding);
      assert(kernel.truths);
    });

    await test('Phase 8 Pipeline Integration', async () => {
      // Mock modelClient for integration test
      const { modelClient } = require('../../model/model-client.cjs');
      const originalInvoke = modelClient.invoke;
      modelClient.invoke = async () => ({
        text: 'I am a stable system.',
        provider: 'mock', model: 'mock', ts: Date.now(),
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, attempts: 1
      });

      const r = await kernel.handle('hello esma', { sessionId: 'p8-integration-test' });
      eq(r.ok, true);
      assert(r.floorLocked === false);
      assert(typeof r.welfareStatus === 'string');
      
      modelClient.invoke = originalInvoke;
    });
  });
};
