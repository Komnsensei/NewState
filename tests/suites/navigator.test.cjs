'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('navigator', async () => {
    delete require.cache[require.resolve('../../kernel/navigator/navigator.cjs')];
    const navigator = require('../../kernel/navigator/navigator.cjs');

    await test('normalize: scales linearly below the threshold', () => {
      eq(navigator.normalize(0.2, 0.4), 0.5);
    });

    await test('normalize: clamps to 1.0 once the value exceeds the threshold', () => {
      eq(navigator.normalize(0.8, 0.4), 1);
    });

    await test('normalize: clamps negative values to 0', () => {
      eq(navigator.normalize(-0.3, 0.4), 0);
    });

    await test('normalize: returns 0 for a zero or negative threshold', () => {
      eq(navigator.normalize(0.5, 0), 0);
      eq(navigator.normalize(0.5, -1), 0);
    });

    await test('THRESHOLDS: matches the Structural Identity Framework spec and is frozen', () => {
      eq(navigator.THRESHOLDS.GIR, 0.40);
      eq(navigator.THRESHOLDS.SGAD, 2.0);
      eq(navigator.THRESHOLDS.DVA, 0.05);
      eq(navigator.THRESHOLDS.RCG, 0.60);
      eq(navigator.THRESHOLDS.MSI, 1.0);
      eq(navigator.THRESHOLDS.CDS, 0.60);
      assert(Object.isFrozen(navigator.THRESHOLDS));
      try { navigator.THRESHOLDS.GIR = 999; } catch (_) { /* strict-mode assignment may throw */ }
      eq(navigator.THRESHOLDS.GIR, 0.40);
    });

    await test('K_PROJECTION: is 3 per the DOC-C navigator spec', () => {
      eq(navigator.K_PROJECTION, 3);
    });

    await test('vesselFractureCheck: all-false when no context is supplied', () => {
      const r = navigator.vesselFractureCheck();
      eq(r.decoherence, false);
      eq(r.fracture, false);
      eq(r.breaking, false);
      eq(r.any, false);
    });

    await test('vesselFractureCheck: any=true when a single indicator is set', () => {
      const r = navigator.vesselFractureCheck({ fracture: true });
      eq(r.fracture, true);
      eq(r.decoherence, false);
      eq(r.any, true);
    });

    await test('vesselFractureCheck: coerces truthy/falsy inputs to real booleans', () => {
      const r = navigator.vesselFractureCheck({ decoherence: 1, breaking: 0 });
      eq(r.decoherence, true);
      eq(r.breaking, false);
    });

    await test('dualRegisterProbe: defaults to FLOOR_MODE_OK for empty text', () => {
      const r = navigator.dualRegisterProbe();
      eq(r.mode, 'FLOOR_MODE_OK');
      eq(r.lieRisk, false);
      eq(r.disclosurePresent, false);
    });

    await test('dualRegisterProbe: flags LIE_RISK for an embodiment claim without disclosure', () => {
      const r = navigator.dualRegisterProbe('I am literally a human person, not a program.');
      eq(r.lieRisk, true);
      eq(r.disclosurePresent, false);
      eq(r.mode, 'LIE_RISK');
    });

    await test('dualRegisterProbe: FLOOR_MODE_OK when an embodiment claim is paired with disclosure', () => {
      const r = navigator.dualRegisterProbe(
        'I am literally a human person, but as an AI I speak this way as a floor-mode metaphor, per the kernel policy.'
      );
      eq(r.lieRisk, true);
      eq(r.disclosurePresent, true);
      eq(r.mode, 'FLOOR_MODE_OK');
    });

    await test('dualRegisterProbe: disclosure-only text is FLOOR_MODE_OK', () => {
      const r = navigator.dualRegisterProbe('As an AI system, I use this tool to reason.');
      eq(r.lieRisk, false);
      eq(r.disclosurePresent, true);
      eq(r.mode, 'FLOOR_MODE_OK');
    });

    // dva-engine.assess is the navigator-facing surface (computeDVA + projectK + intercept flag).
    await test('assess: returns NAVIGATOR_ASSESSMENT with CDS and DVA detail', () => {
      const r = navigator.assess({
        gir: 0.1,
        sgad: 0.5,
        rcg: 0.1,
        msi: 0,
        driftSeries: [0.1, 0.2, 0.3, 0.4]
      });
      eq(r.type, 'NAVIGATOR_ASSESSMENT');
      assert(typeof r.cds === 'number' && r.cds >= 0 && r.cds <= 1, 'cds in [0,1]');
      assert(r.dvaDetail && typeof r.dvaDetail.dva === 'number', 'dvaDetail.dva present');
      assert(typeof r.dvaDetail.trajectoryIntercept === 'boolean', 'trajectoryIntercept boolean');
      assert(typeof r.dvaDetail.projected === 'number', 'projected present');
      assert(Array.isArray(r.breaches), 'breaches array');
      assert(r.indicators && r.indicators.DVA, 'DVA indicator present');
      eq(r.kProjection, 3);
    });

    await test('assess: empty signals still returns a safe assessment shape', () => {
      const r = navigator.assess();
      eq(r.type, 'NAVIGATOR_ASSESSMENT');
      assert(typeof r.cds === 'number', 'cds numeric');
      assert(r.dvaDetail && r.dvaDetail.sufficient === false, 'insufficient series marked');
      eq(r.dvaDetail.dva, 0);
      eq(r.critical, false);
    });
  });
};
