'use strict';
const { build } = require('../../model/prompt-builder.cjs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('prompt-builder', async () => {
    await test('includes truth frame preamble', () => {
      const p = build({ userMessage: 'hi' });
      assert(p.includes('[MODEL REALITY FRAME]'));
      assert(p.includes('[USER MESSAGE]'));
    });

    await test('omits memory section when empty', () => {
      const p = build({ userMessage: 'hi' });
      assert(!p.includes('[MEMORY CONTEXT]'));
    });

    await test('includes memory section when provided', () => {
      const p = build({ userMessage: 'hi', memoryPacket: 'fact1' });
      assert(p.includes('[MEMORY CONTEXT]'));
      assert(p.includes('fact1'));
    });
  });
};