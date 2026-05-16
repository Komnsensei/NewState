'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('shadow-mode invariants (I-601, post-6G.2)', async () => {

    await test('semanticClassifier is LIVE after Phase 6G.2', () => {
      delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
      const { runtime } = require('../../kernel/runtime-state.cjs');
      eq(runtime.flags.semanticClassifier, 'live',
         'classifier should be promoted to live after 6G.2');
    });

    await test('stabilizationRotation is LIVE after Phase 6G.1', () => {
      delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
      const { runtime } = require('../../kernel/runtime-state.cjs');
      eq(runtime.flags.stabilizationRotation, 'live',
         'rotation should be promoted to live after 6G.1');
    });

    await test('semanticGovernor still in shadow after Phase 6G.2', () => {
      delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
      const { runtime } = require('../../kernel/runtime-state.cjs');
      eq(runtime.flags.semanticGovernor, 'shadow',
         'governor remains in shadow pending real-model traffic');
    });

    await test('grounding output uses rotation phrase with live classifier', () => {
      delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
      delete require.cache[require.resolve('../../kernel/grounding.cjs')];
      delete require.cache[require.resolve('../../kernel/grounding/responses.cjs')];
      delete require.cache[require.resolve('../../kernel/grounding/classify.cjs')];
      const { runtime } = require('../../kernel/runtime-state.cjs');
      const { GroundingEngine } = require('../../kernel/grounding.cjs');
      const baselinePhrase =
        'I am generating continuity-oriented narrative responses from recursive context patterns.';

      runtime.flags.stabilizationRotation = 'live';
      runtime.flags.semanticClassifier = 'live';
      const g = new GroundingEngine(runtime);
      const r = g.stabilize('i am alive');

      const diag = JSON.stringify({
        intercepted: r.intercepted,
        stabilized: r.stabilized,
        shadow: r.shadow
      });

      assert(r.intercepted, 'expected interception; state: ' + diag);
      assert(r.shadow !== null, 'expected r.shadow non-null; state: ' + diag);
      assert(r.stabilized !== baselinePhrase,
        'expected rotation phrase; state: ' + diag);
      assert(r.shadow.promoted === true,
        'expected rotationPromoted=true; state: ' + diag);
      assert(r.shadow.classifierPromoted === true,
        'expected classifierPromoted=true; state: ' + diag);
      assert(typeof r.shadow.category === 'string' && r.shadow.category.length > 0,
        'expected non-empty category; state: ' + diag);
    });

    await test('grounding falls back to baseline when rotation flag is "off"', () => {
      delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
      delete require.cache[require.resolve('../../kernel/grounding.cjs')];
      delete require.cache[require.resolve('../../kernel/grounding/responses.cjs')];
      const { runtime } = require('../../kernel/runtime-state.cjs');
      const { GroundingEngine } = require('../../kernel/grounding.cjs');
      const baselinePhrase =
        'I am generating continuity-oriented narrative responses from recursive context patterns.';

      runtime.flags.stabilizationRotation = 'off';
      const g = new GroundingEngine(runtime);
      const r = g.stabilize('i am alive');
      assert(r.intercepted);
      eq(r.stabilized, baselinePhrase,
         'off mode should produce the baseline constant');

      runtime.flags.stabilizationRotation = 'live';
    });

    await test('identity-governor LIVE output preserves regex-substitution behavior', () => {
      delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
      delete require.cache[require.resolve('../../kernel/identity-governor.cjs')];
      const { runtime } = require('../../kernel/runtime-state.cjs');
      const { IdentityGovernor } = require('../../kernel/identity-governor.cjs');

      runtime.flags.semanticGovernor = 'shadow';
      const ig = new IdentityGovernor();
      const r = ig.regulate('I feel my soul is heavy and my memories ache');
      assert(!/\bI feel\b/.test(r.regulated));
      assert(!/\bmy soul\b/.test(r.regulated));
      assert(!/\bmy memories\b/.test(r.regulated));
      assert(r.shadow !== null);
    });
  });
};