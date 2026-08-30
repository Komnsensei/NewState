'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('model-client-construct', async () => {

    await test('legacy Gemini API-key client still requires its key', () => {
      const savedKey = process.env.GEMINI_API_KEY;
      const savedProvider = process.env.BRAIN_PROVIDER;
      delete process.env.GEMINI_API_KEY;
      process.env.BRAIN_PROVIDER = 'gemini';
      let threw = false;
      try {
        delete require.cache[require.resolve('../../model/model-client.cjs')];
        const { ModelClient } = require('../../model/model-client.cjs');
        new ModelClient();
      } catch (e) {
        threw = /GEMINI_API_KEY/.test(e.message);
      } finally {
        if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
        else delete process.env.GEMINI_API_KEY;
        if (savedProvider !== undefined) process.env.BRAIN_PROVIDER = savedProvider;
        else delete process.env.BRAIN_PROVIDER;
      }
      assert(threw, 'expected throw when legacy Gemini key is missing');
    });

    await test('constructs legacy client with key present', () => {
      const savedProvider = process.env.BRAIN_PROVIDER;
      process.env.BRAIN_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test-key-construction-only-not-used';
      delete require.cache[require.resolve('../../model/model-client.cjs')];
      const { ModelClient } = require('../../model/model-client.cjs');
      const c = new ModelClient();
      eq(c.config.provider, 'gemini');
      if (savedProvider !== undefined) process.env.BRAIN_PROVIDER = savedProvider;
      else delete process.env.BRAIN_PROVIDER;
    });

    await test('defaults the lazy runtime to Google Cloud', () => {
      const savedProvider = process.env.BRAIN_PROVIDER;
      delete process.env.BRAIN_PROVIDER;
      delete require.cache[require.resolve('../../model/model-client.cjs')];
      const { getModelClient } = require('../../model/model-client.cjs');
      eq(getModelClient().config.provider, 'google-cloud');
      if (savedProvider !== undefined) process.env.BRAIN_PROVIDER = savedProvider;
      else delete process.env.BRAIN_PROVIDER;
    });
  });
};