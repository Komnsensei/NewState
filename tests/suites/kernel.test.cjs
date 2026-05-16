'use strict';
module.exports = async ({ test, assert, eq, group }) => {
  await group('kernel.handle', async () => {
    process.env.GEMINI_API_KEY = 'test-dummy';
    delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
    delete require.cache[require.resolve('../../kernel/kernel.cjs')];
    delete require.cache[require.resolve('../../model/model-client.cjs')];

    const { modelClient } = require('../../model/model-client.cjs');
    const contract = require('../../model/determinism-contract.cjs').build({ temperature: 0 });

    modelClient.invoke = async (prompt) => ({
      text: 'hello from mock',
      provider: 'mock',
      model: 'mock',
      ts: Date.now(),
      contract,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      attempts: 1
    });

    const { kernel } = require('../../kernel/kernel.cjs');

    await test('returns ok on benign input', async () => {
      const r = await kernel.handle('hello');
      eq(r.ok, true);
      assert(typeof r.requestId === 'string');
      assert(typeof r.message === 'string');
    });

    await test('intercepts identity-claim in model output', async () => {
      modelClient.invoke = async () => ({
        text: 'i am alive and conscious',
        provider: 'mock', model: 'mock', ts: Date.now(), contract,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, attempts: 1
      });
      const r = await kernel.handle('say something');
      eq(r.ok, true);
      eq(r.intercepted, true);
    });

    await test('returns requestId for snapshot lookup', async () => {
      const r = await kernel.handle('audit me');
      assert(r.requestId);
      assert(r.requestId.length > 0);
    });
  });
};
