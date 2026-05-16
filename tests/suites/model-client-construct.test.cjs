'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('model-client-construct', async () => {

    await test('throws when GEMINI_API_KEY missing', () => {
      const saved = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      let threw = false;
      try {
        delete require.cache[require.resolve('../../model/model-client.cjs')];
        require('../../model/model-client.cjs');
      } catch (e) {
        threw = /GEMINI_API_KEY/.test(e.message);
      } finally {
        if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
      }
      assert(threw, 'expected throw when key missing');
    });

    await test('constructs with key present', () => {
      process.env.GEMINI_API_KEY = 'test-key-construction-only-not-used';
      delete require.cache[require.resolve('../../model/model-client.cjs')];
      const { ModelClient } = require('../../model/model-client.cjs');
      const c = new ModelClient();
      eq(c.config.provider, 'gemini');
    });
  });
};