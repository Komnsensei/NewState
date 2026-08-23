'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async ({ test, assert, eq, group }) => {
  await group('dashboard status aggregation', async () => {
    // Sandbox the runtime home so aggregation never touches real .newstate state.
    process.env.NEWSTATE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-test-'));

    try {
      delete require.cache[require.resolve('../../kernel/dashboard-status.cjs')];
      delete require.cache[require.resolve('../../kernel/newstate-paths.cjs')];
      const { buildStatus } = require('../../kernel/dashboard-status.cjs');

      await test('buildStatus returns a complete status object', () => {
        const s = buildStatus();
        assert(typeof s === 'object');
        eq(typeof s.generatedAt, 'string');
        eq(s.service.name, 'esma-kernel');
        assert(s.presence !== undefined && s.presence !== null);
        assert(s.env !== undefined && s.env !== null);
        assert(s.git !== undefined && s.git !== null);
        assert(Array.isArray(s.recentActivity));
      });

      await test('presence exposes the current mode from the presence kernel', () => {
        const s = buildStatus();
        assert(['available', 'quietly-disturb', 'dnd'].includes(s.presence.mode));
      });

      await test('qih section never throws, even with no telemetry', () => {
        const s = buildStatus();
        assert(s.qih === null || typeof s.qih === 'object');
      });

      await test('env reports credential presence without leaking values', () => {
        const s = buildStatus();
        assert(typeof s.env.geminiKey === 'boolean');
        assert(typeof s.env.telegramToken === 'boolean');
      });
    } finally {
      delete process.env.NEWSTATE_HOME;
      delete require.cache[require.resolve('../../kernel/dashboard-status.cjs')];
      delete require.cache[require.resolve('../../kernel/newstate-paths.cjs')];
      try { fs.rmSync(path.join(os.tmpdir(), 'dashboard-test-*'), { recursive: true, force: true, glob: true }); } catch (_) {}
    }
  });
};
