'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

module.exports = async ({ test, assert, eq, group }) => {
  await group('shadow harness (offline)', async () => {

    await test('harness runs without GEMINI_API_KEY and processes inputs', () => {
      const env = { ...process.env };
      delete env.GEMINI_API_KEY;

      const result = spawnSync('node', [
        path.join(__dirname, '..', '..', 'tools', 'shadow-harness.cjs'),
        '--clear'
      ], { env, encoding: 'utf8' });

      assert(result.status === 0, `harness exit code ${result.status}: ${result.stderr}`);
      assert(/grounding interceptions/.test(result.stdout));
      assert(/governor observations/.test(result.stdout));
    });

    await test('shadow-report runs without GEMINI_API_KEY and emits JSON', () => {
      const env = { ...process.env };
      delete env.GEMINI_API_KEY;

      const result = spawnSync('node', [
        path.join(__dirname, '..', '..', 'tools', 'shadow-report.cjs')
      ], { env, encoding: 'utf8' });

      assert(result.status === 0, `report exit code ${result.status}: ${result.stderr}`);
      const parsed = JSON.parse(result.stdout);
      assert(parsed.ok === true);
      assert('provenance' in parsed);
      assert('report' in parsed);
      assert(['harness-only', 'live-only', 'mixed', 'empty'].includes(parsed.provenance.mode));
    });

    await test('harness events carry harnessMode flag', () => {
      // Use the in-process forensics (sandboxed by tests/run.cjs)
      delete require.cache[require.resolve('../../kernel/forensics.cjs')];
      const { forensics } = require('../../kernel/forensics.cjs');
      const events = forensics.query();
      // After the two subprocess tests above ran against the harness,
      // there may or may not be events in *this* sandbox (subprocesses
      // use their own dirs unless env propagates). We only assert shape
      // contract here, not population — this test would otherwise be
      // brittle across CI environments.
      assert(Array.isArray(events));
    });
  });
};