'use strict';
const { redactString, redactDeep } = require('../../kernel/redact.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('redaction', async () => {

    await test('Google-shaped key pattern redacted', () => {
      const out = redactString('key is AIzaSyA1234567890abcdefghijklmnopqrstuv');
      assert(out.includes('[REDACTED-GOOGLE-KEY]'));
      assert(!out.includes('AIzaSyA1234567890'));
    });

    await test('env-loaded secret value redacted when present', () => {
      const saved = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'fake-test-secret-value-1234567890';
      try {
        const out = redactString('prompt contains fake-test-secret-value-1234567890 inline');
        assert(out.includes('[REDACTED-SECRET]'));
        assert(!out.includes('fake-test-secret-value-1234567890'));
      } finally {
        process.env.GEMINI_API_KEY = saved;
      }
    });

    await test('deep redaction walks nested structures', () => {
      const out = redactDeep({
        a: { b: 'AIzaSyA1234567890abcdefghijklmnopqrstuv', c: [ 'AIzaSyB9876543210zyxwvutsrqponmlkjihg' ] }
      });
      assert(out.a.b.includes('[REDACTED-GOOGLE-KEY]'));
      assert(out.a.c[0].includes('[REDACTED-GOOGLE-KEY]'));
    });

    await test('non-string primitives pass through', () => {
      eq(redactDeep(42), 42);
      eq(redactDeep(null), null);
      eq(redactDeep(true), true);
    });
  });
};