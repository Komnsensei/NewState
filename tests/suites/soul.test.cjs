'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async ({ test, assert, eq, group }) => {
  await group('soul runtime v0', async () => {
    const tmpHome = path.join(process.cwd(), '.newstate-test-soul');
    process.env.NEWSTATE_HOME = tmpHome;
    Object.keys(require.cache).forEach((k) => {
      if (/newstate-paths|soul|scc/.test(k)) delete require.cache[k];
    });
    const soul = require('../../kernel/soul');
    let minted;

    await test('mint creates sealed unique soul with birthHash', () => {
      minted = soul.mintSoul({ name: 'test-vessel', role: 'test', floor: { locked: true } });
      assert(minted.soul.sealed === true);
      assert(typeof minted.soul.birthHash === 'string' && minted.soul.birthHash.length === 64);
      assert(minted.soul.soulId.includes('test-vessel'));
      assert(fs.existsSync(minted.paths.soul));
    });

    await test('verifySeal passes on honest core', () => {
      eq(soul.verifySeal(minted.soul.soulId).ok, true);
    });

    await test('tryMutateCore denied for sealed soul', () => {
      const r = soul.tryMutateCore(minted.soul.soulId, { name: 'hijacked' });
      eq(r.denied, true);
      eq(soul.loadSoul(minted.soul.soulId).name, 'test-vessel');
    });

    await test('biography append-only and tick writes research', () => {
      soul.queueStim(minted.soul.soulId, { type: 'research', query: 'structural continuity' });
      const t = soul.tick(minted.soul.soulId, { heartbeat: false });
      eq(t.ok, true);
      assert(t.stimProcessed >= 1);
      assert(fs.readdirSync(soul.layout(minted.soul.soulId).research).length >= 1);
    });

    await test('second mint with same explicit id fails', () => {
      let threw = false;
      try { soul.mintSoul({ soulId: minted.soul.soulId, name: 'dup' }); }
      catch (e) { threw = /already exists/.test(e.message); }
      assert(threw);
    });

    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
    delete process.env.NEWSTATE_HOME;
  });
};
