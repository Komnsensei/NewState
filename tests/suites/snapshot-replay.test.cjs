'use strict';
module.exports = async ({ test, assert, eq, group }) => {
  await group('snapshot + replay', async () => {
    process.env.GEMINI_API_KEY = 'test-dummy';
    delete require.cache[require.resolve('../../kernel/kernel.cjs')];
    delete require.cache[require.resolve('../../kernel/snapshot.cjs')];
    delete require.cache[require.resolve('../../kernel/replay.cjs')];
    delete require.cache[require.resolve('../../model/model-client.cjs')];

    const { modelClient } = require('../../model/model-client.cjs');
    const contract = require('../../model/determinism-contract.cjs').build({ temperature: 0 });
    modelClient.invoke = async () => ({
      text: 'mock response',
      provider: 'mock', model: 'mock', ts: Date.now(), contract,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, attempts: 1
    });

    const { kernel } = require('../../kernel/kernel.cjs');
    const { readBundle } = require('../../kernel/snapshot.cjs');
    const { replay } = require('../../kernel/replay.cjs');
    let rid;

    await test('handle writes a snapshot bundle', async () => {
      const r = await kernel.handle('snapshot probe');
      rid = r.requestId;
      const b = readBundle(rid);
      assert(b !== null);
      assert(b.userMessage);
      assert(b.modelResponse);
    });

    await test('recorded replay produces a report', async () => {
      const r = await replay(rid, kernel, { mode: 'recorded' });
      eq(r.ok, true);
      eq(r.report.mode, 'recorded');
    });
  });
};
