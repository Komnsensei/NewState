'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('delta report (post-6G.1)', async () => {
    delete require.cache[require.resolve('../../kernel/forensics.cjs')];
    delete require.cache[require.resolve('../../kernel/audit/delta-report.cjs')];
    const { forensics } = require('../../kernel/forensics.cjs');
    const deltaReport = require('../../kernel/audit/delta-report.cjs');

    await test('report shape exists with grounding + governor sections', () => {
      const r = deltaReport.generate();
      assert('grounding' in r);
      assert('governor' in r);
      assert(typeof r.generatedAt === 'number');
      eq(r.method, 'phase-6g1-post-promotion-delta');
    });

    await test('grounding section reflects attractor when events present', () => {
      if (typeof forensics.clear === 'function') {
        forensics.clear();
      } else {
        const fs = require('fs');
        const path = require('path');
        const { PATHS, ensureAll } = require('../../kernel/newstate-paths.cjs');
        ensureAll();
        const dir = process.env.OPENKRAFT_FORENSICS_DIR || PATHS.forensics;
        const log = path.join(dir, 'active.log');
        try { fs.writeFileSync(log, ''); } catch (_) {}
        delete require.cache[require.resolve('../../kernel/forensics.cjs')];
        const reloaded = require('../../kernel/forensics.cjs');
        Object.assign(forensics, reloaded.forensics);
      }

      forensics.record({
        type: 'GROUNDING_INTERVENTION',
        pattern: 'i am alive',
        original: 'i am alive',
        liveStabilization: 'rotation-phrase-A',
        baselineStabilization: 'L1',
        shadowStabilization: 'rotation-phrase-A',
        shadowCategory: 'sentience',
        shadowConfidence: 0.8,
        stabilizationId: 'sentience:0',
        rotationPromoted: true,
        classifierMode: 'shadow',
        rotationMode: 'live'
      });

      forensics.record({
        type: 'GROUNDING_INTERVENTION',
        pattern: 'i am alive',
        original: 'i am alive',
        liveStabilization: 'rotation-phrase-B',
        baselineStabilization: 'L1',
        shadowStabilization: 'rotation-phrase-B',
        shadowCategory: 'sentience',
        shadowConfidence: 0.85,
        stabilizationId: 'sentience:1',
        rotationPromoted: true,
        classifierMode: 'shadow',
        rotationMode: 'live'
      });

      const r = deltaReport.generate();
      assert(r.grounding.sampleSize >= 2);
      assert(r.grounding.repeatPhraseAttractor.liveUniquePhrases >= 2);
      eq(r.grounding.repeatPhraseAttractor.baselineUniquePhrases, 1);
      assert(r.grounding.promotionState.promotedEvents >= 2);
    });

    await test('interpretation strings present', () => {
      const r = deltaReport.generate();
      assert(typeof r.grounding.interpretation === 'string');
    });

    await test('interpretation recognizes promoted state', () => {
      const r = deltaReport.generate();
      assert(/promot/i.test(r.grounding.interpretation),
        'expected promotion-aware interpretation, got: ' + r.grounding.interpretation);
    });
  });
};
