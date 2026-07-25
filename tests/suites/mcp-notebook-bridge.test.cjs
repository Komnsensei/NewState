'use strict';

const fs = require('fs');
const path = require('path');

const SYNC_DIR = path.join(__dirname, '..', '..', 'memory', 'notebook-sync');

module.exports = async ({ test, assert, eq, group }) => {
  await group('mcp-server notebook-bridge', async () => {
    const existedBefore = fs.existsSync(SYNC_DIR);
    const priorFiles = existedBefore ? fs.readdirSync(SYNC_DIR) : [];

    delete process.env.NOTEBOOK_ACCOUNT;
    delete require.cache[require.resolve('../../mcp-server/lib/notebook-bridge.js')];
    const bridge = require('../../mcp-server/lib/notebook-bridge.js');

    try {
      await test('ACCOUNT: defaults to shawnru391@gmail.com', () => {
        eq(bridge.ACCOUNT, 'shawnru391@gmail.com');
      });

      await test('stageForNotebook: writes a to_notebook JSON record tagged with the account', () => {
        const { path: full, record } = bridge.stageForNotebook({ payloadKind: 'unit-test' });
        assert(fs.existsSync(full));
        eq(record.account, 'shawnru391@gmail.com');
        eq(record.direction, 'to_notebook');
        eq(record.payloadKind, 'unit-test');
        assert(typeof record.stagedAt === 'string');
        const onDisk = JSON.parse(fs.readFileSync(full, 'utf8'));
        eq(onDisk.payloadKind, 'unit-test');
      });

      await test('injectFromNotebook: writes an inbound in_*.json record', () => {
        const record = bridge.injectFromNotebook({ text: 'hi from notebook' });
        eq(record.direction, 'from_notebook');
        eq(record.account, 'shawnru391@gmail.com');
        eq(record.message.text, 'hi from notebook');
        assert(typeof record.injectedAt === 'string');
        const files = fs.readdirSync(SYNC_DIR).filter((f) => f.startsWith('in_'));
        assert(files.length >= 1);
      });

      await test('pullFromNotebook: returns queued inbound messages and marks them processed', () => {
        bridge.injectFromNotebook({ text: 'second inbound' });
        const before = fs.readdirSync(SYNC_DIR).filter((f) => f.startsWith('in_') && !f.startsWith('processed_'));
        assert(before.length >= 1);

        const inbound = bridge.pullFromNotebook();
        assert(Array.isArray(inbound));
        assert(inbound.some((m) => m.message && m.message.text === 'second inbound'));

        const remaining = fs.readdirSync(SYNC_DIR).filter((f) => f.startsWith('in_') && !f.startsWith('processed_'));
        eq(remaining.length, 0);
        const processed = fs.readdirSync(SYNC_DIR).filter((f) => f.startsWith('processed_in_'));
        assert(processed.length >= 1);
      });

      await test('pullFromNotebook: returns an empty array once the inbound queue is drained', () => {
        eq(bridge.pullFromNotebook().length, 0);
      });

      await test('NOTEBOOK_ACCOUNT env var overrides the default account', () => {
        process.env.NOTEBOOK_ACCOUNT = 'custom@example.com';
        delete require.cache[require.resolve('../../mcp-server/lib/notebook-bridge.js')];
        const custom = require('../../mcp-server/lib/notebook-bridge.js');
        eq(custom.ACCOUNT, 'custom@example.com');
        const { record } = custom.stageForNotebook({ note: 'custom-account' });
        eq(record.account, 'custom@example.com');
      });
    } finally {
      delete process.env.NOTEBOOK_ACCOUNT;
      delete require.cache[require.resolve('../../mcp-server/lib/notebook-bridge.js')];
      if (existedBefore) {
        for (const f of fs.readdirSync(SYNC_DIR)) {
          if (!priorFiles.includes(f)) fs.unlinkSync(path.join(SYNC_DIR, f));
        }
      } else {
        fs.rmSync(SYNC_DIR, { recursive: true, force: true });
      }
    }
  });
};