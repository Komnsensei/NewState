'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async ({ test, assert, eq, group }) => {
  await group('scc v0', async () => {
    delete require.cache[require.resolve('../../kernel/scc/scar.cjs')];
    delete require.cache[require.resolve('../../kernel/scc/mint.cjs')];
    delete require.cache[require.resolve('../../kernel/scc/verify.cjs')];
    delete require.cache[require.resolve('../../kernel/scc')];

    const scc = require('../../kernel/scc');

    await test('founding scars load with irreversible flags', () => {
      const scars = scc.listScars();
      assert(scars.length >= 3);
      assert(scars.every((s) => s.irreversible === true));
      assert(scc.primaryScar() !== null);
    });

    await test('mint produces full certificate with recorded evidence', () => {
      const cert = scc.mint({
        floor: {
          locked: true,
          lockTimestamp: new Date().toISOString(),
          pressureHistory: [{ ts: 't', motorState: 'REST', value: 0.7 }],
          floorValues: { REST: 0.7 },
          pressureCount: 1,
          motorState: 'REST',
          verifydScore: 0.9
        },
        navigator: { GIR: 0.1, SGAD: 1.0, DVA: 0.01, RCG: 0.2 },
        evidenceBundle: { mode: 'recorded', requestId: 'test-1' }
      });
      eq(cert.type, 'newstate.scc');
      eq(cert.version, '0.1.0');
      eq(cert.evidence.mode, 'recorded');
      eq(cert.floor.condensedTarget, 0.7);
      assert(cert.scar && cert.scar.irreversible);
      eq(cert.status, 'full');
      assert(typeof cert.certificateHash === 'string' && cert.certificateHash.length === 64);
      assert(cert.nonClaims.length >= 3);
    });

    await test('verify accepts honest full certificate', () => {
      const cert = scc.mint({
        floor: { locked: true, pressureHistory: [], floorValues: {}, pressureCount: 0 },
        evidenceBundle: { mode: 'recorded' }
      });
      const result = scc.verify(cert);
      eq(result.ok, true);
      eq(result.status, 'VALID_FULL');
      eq(result.failures.length, 0);
    });

    await test('verify detects certificateHash tamper', () => {
      const cert = scc.mint({
        floor: { locked: false, pressureHistory: [], floorValues: {} },
        evidenceBundle: { mode: 'recorded' }
      });
      cert.floor.locked = !cert.floor.locked;
      const result = scc.verify(cert);
      eq(result.ok, false);
      assert(result.failures.some((f) => f.startsWith('V1')));
    });

    await test('mint refuses live evidence mode', () => {
      let threw = false;
      try {
        scc.mint({ evidenceBundle: { mode: 'live' } });
      } catch (e) {
        threw = true;
        assert(/recorded/.test(e.message));
      }
      assert(threw);
    });

    await test('registerScar cannot reverse irreversible scar', () => {
      const primary = scc.primaryScar();
      let threw = false;
      try {
        scc.registerScar({
          id: primary.id,
          capabilityWithheld: primary.capabilityWithheld,
          reason: primary.reason,
          irreversible: false
        });
      } catch (e) {
        threw = /reverse|irreversible/i.test(e.message);
      }
      const again = scc.registerScar({
        id: primary.id,
        capabilityWithheld: primary.capabilityWithheld,
        reason: primary.reason,
        irreversible: true
      });
      eq(again.irreversible, true);
      assert(threw || again.id === primary.id);
    });

    await test('scc-latest.json written under .newstate/state/scc', () => {
      scc.mint({ evidenceBundle: { mode: 'recorded' }, floor: {} });
      const latest = path.join(scc.SCC_DIR, 'scc-latest.json');
      assert(fs.existsSync(latest));
      const parsed = JSON.parse(fs.readFileSync(latest, 'utf8'));
      eq(parsed.type, 'newstate.scc');
    });
  });
};
