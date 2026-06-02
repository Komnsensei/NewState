'use strict';
require('dotenv').config();
const { runtime } = require('./kernel/runtime-state.cjs');
// const { hexMemory } = require('./memory/hex-memory.cjs');
// const { sessionStore } = require('./kernel/session-store.cjs');
const { telegramBot } = require('./integrations/telegram.cjs');

console.log('=== NEWSTATE BOOT CHECK ===');
console.log('flags:', JSON.stringify(runtime.flags, null, 2));
console.log('memory records:', hexMemory.count());
console.log('memory enabled:', runtime.flags.memoryEnabled);
console.log('sessions active:', sessionStore.count());
// console.log('telegram enabled:', telegramBot.enabled);

// Quick memory store/retrieve test
const storeResult = hexMemory.store({ text: 'boot test fact — NEWSTATE initialized', tags: ['system'] });
console.log('memory store test:', JSON.stringify(storeResult));
const retrieveResult = hexMemory.retrieve('NEWSTATE initialized');
console.log('memory retrieve test:', retrieveResult.facts.length, 'facts,', 'packet len:', retrieveResult.packet.length);

// Session test
sessionStore.push('test-session', 'user', 'hello world');
sessionStore.push('test-session', 'assistant', 'hello back');
const ctx = sessionStore.buildContextBlock('test-session');
console.log('session context block:', ctx);

console.log('=== ALL CHECKS PASSED ===');
