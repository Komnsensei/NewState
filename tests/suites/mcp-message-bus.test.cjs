'use strict';

const fs = require('fs');
const path = require('path');

const BUS_PATH = path.join(__dirname, '..', '..', 'memory', 'agent-bus.jsonl');

module.exports = async ({ test, assert, eq, group }) => {
  await group('mcp-server message-bus', async () => {
    const existedBefore = fs.existsSync(BUS_PATH);
    const backup = existedBefore ? fs.readFileSync(BUS_PATH, 'utf8') : null;

    delete require.cache[require.resolve('../../mcp-server/lib/message-bus.js')];
    const bus = require('../../mcp-server/lib/message-bus.js');

    try {
      await test('publish: returns an envelope with a generated id/timestamp merged with the payload', () => {
        const envelope = bus.publish({ sender: 'test', message: 'hello' });
        assert(typeof envelope.id === 'string' && envelope.id.startsWith('msg_'));
        assert(typeof envelope.timestamp === 'string');
        eq(envelope.sender, 'test');
        eq(envelope.message, 'hello');
      });

      await test('publish: persists the envelope to the agent-bus.jsonl ledger', () => {
        assert(fs.existsSync(BUS_PATH));
        const lines = fs.readFileSync(BUS_PATH, 'utf8').trim().split('\n');
        const last = JSON.parse(lines[lines.length - 1]);
        eq(last.sender, 'test');
        eq(last.message, 'hello');
      });

      await test('recent: returns the most recently published in-memory messages', () => {
        bus.publish({ sender: 'a', message: '1' });
        bus.publish({ sender: 'b', message: '2' });
        bus.publish({ sender: 'c', message: '3' });
        const recent = bus.recent(2);
        eq(recent.length, 2);
        eq(recent[0].message, '2');
        eq(recent[1].message, '3');
      });

      await test('subscribe: broadcasts to every subscriber when no target is set', () => {
        const seenA = [];
        const seenB = [];
        const unsubA = bus.subscribe('agentA', (env) => seenA.push(env));
        const unsubB = bus.subscribe('agentB', (env) => seenB.push(env));
        bus.publish({ sender: 'x', message: 'broadcast' });
        eq(seenA.length, 1);
        eq(seenB.length, 1);
        unsubA();
        unsubB();
      });

      await test('subscribe: a targeted message reaches the matching target once and every other subscriber once', () => {
        const seenTarget = [];
        const seenOther = [];
        const unsubTarget = bus.subscribe('agentA', (env) => seenTarget.push(env));
        const unsubOther = bus.subscribe('agentB', (env) => seenOther.push(env));
        bus.publish({ sender: 'x', message: 'direct', target: 'agentA' });
        eq(seenTarget.length, 1, 'target subscriber should be called exactly once, not twice');
        eq(seenOther.length, 1, 'non-target subscriber still receives the broadcast loop call');
        unsubTarget();
        unsubOther();
      });

      await test('subscribe: the returned unsubscribe function stops further delivery', () => {
        const seen = [];
        const unsub = bus.subscribe('agentC', (env) => seen.push(env));
        bus.publish({ sender: 'x', message: 'one' });
        unsub();
        bus.publish({ sender: 'x', message: 'two' });
        eq(seen.length, 1);
      });

      await test('publish: emits a "message" event for generic EventEmitter listeners', () => {
        let received = null;
        const handler = (env) => { received = env; };
        bus.on('message', handler);
        bus.publish({ sender: 'x', message: 'event-emitter-check' });
        bus.off('message', handler);
        assert(received !== null);
        eq(received.message, 'event-emitter-check');
      });

      await test('history: reads persisted entries back from disk, most recent last', () => {
        const hist = bus.history(3);
        assert(Array.isArray(hist));
        assert(hist.length > 0);
        eq(hist[hist.length - 1].message, 'event-emitter-check');
      });

      await test('history: returns [] when the ledger file does not exist on disk', () => {
        const tmpBackup = fs.existsSync(BUS_PATH) ? fs.readFileSync(BUS_PATH, 'utf8') : null;
        fs.unlinkSync(BUS_PATH);
        delete require.cache[require.resolve('../../mcp-server/lib/message-bus.js')];
        const freshBus = require('../../mcp-server/lib/message-bus.js');
        eq(freshBus.history().length, 0);
        if (tmpBackup !== null) fs.writeFileSync(BUS_PATH, tmpBackup);
      });
    } finally {
      delete require.cache[require.resolve('../../mcp-server/lib/message-bus.js')];
      if (existedBefore) {
        fs.writeFileSync(BUS_PATH, backup);
      } else if (fs.existsSync(BUS_PATH)) {
        fs.unlinkSync(BUS_PATH);
      }
    }
  });
};