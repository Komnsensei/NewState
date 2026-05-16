'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('replay-determinism', async () => {
    delete require.cache[require.resolve('../../kernel/kernel.cjs')];
    delete require.cache[require.resolve('../../kernel/replay.cjs')];
    const { kernel } = require('../../kernel/kernel.cjs');
    const { replay } = require('../../kernel/replay.cjs');

    await test('recorded replay reports determinism guarantee from bundle', async () => {
      const r = await kernel.handle('determinism probe');
      const rep = await replay(r.requestId, kernel, { mode: 'recorded' });
      eq(rep.ok, true);
      eq(rep.report.mode, 'recorded');
      assert(['pinned', 'best-effort', 'none', 'unknown'].includes(rep.report.determinismGuarantee));
    });

    await test('live replay returns mode=live with similarity + drift fields', async () => {
      const r = await kernel.handle('live probe');
      const rep = await replay(r.requestId, kernel, { mode: 'live' });
      eq(rep.ok, true);
      eq(rep.report.mode, 'live');
      assert('similarity' in rep.report);
      assert('drift' in rep.report);
      assert('hashAuthoritative' in rep.report);
    });
  });
};