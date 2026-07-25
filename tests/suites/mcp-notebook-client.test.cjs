'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('mcp-server notebook-client', async () => {
    delete process.env.MCP_BASE;
    delete require.cache[require.resolve('../../mcp-server/notebook-client.js')];
    const client = require('../../mcp-server/notebook-client.js');

    const originalFetch = global.fetch;
    const originalEventSource = global.EventSource;

    function mockFetch(responseValue) {
      let captured = null;
      global.fetch = async (url, opts) => {
        captured = { url, opts };
        return { json: async () => responseValue };
      };
      return () => captured;
    }

    try {
      await test('MCP_BASE: defaults to http://localhost:3100', () => {
        eq(client.MCP_BASE, 'http://localhost:3100');
      });

      await test('send: POSTs to /agent/send with default sender/targetNode', async () => {
        const getCaptured = mockFetch({ ok: true });
        const result = await client.send('hello world');
        const { url, opts } = getCaptured();
        eq(url, 'http://localhost:3100/agent/send');
        eq(opts.method, 'POST');
        eq(opts.headers['Content-Type'], 'application/json');
        const body = JSON.parse(opts.body);
        eq(body.sender, 'gemini-notebook');
        eq(body.message, 'hello world');
        eq(body.targetNode, 'newstate');
        eq(result.ok, true);
      });

      await test('send: honors custom sender/targetNode/metadata options', async () => {
        const getCaptured = mockFetch({ ok: true });
        await client.send('ping', { sender: 'custom', targetNode: 'other', metadata: { k: 1 } });
        const { opts } = getCaptured();
        const body = JSON.parse(opts.body);
        eq(body.sender, 'custom');
        eq(body.targetNode, 'other');
        eq(body.metadata.k, 1);
      });

      await test('receive: GETs /agent/messages with the given limit', async () => {
        const getCaptured = mockFetch({ messages: [] });
        await client.receive(5);
        const { url } = getCaptured();
        eq(url, 'http://localhost:3100/agent/messages?limit=5');
      });

      await test('receive: defaults the limit to 20', async () => {
        const getCaptured = mockFetch({ messages: [] });
        await client.receive();
        const { url } = getCaptured();
        eq(url, 'http://localhost:3100/agent/messages?limit=20');
      });

      await test('inject: POSTs message + notebookId to /notebook/inject', async () => {
        const getCaptured = mockFetch({ staged: true });
        await client.inject('note text', 'nb-123');
        const { url, opts } = getCaptured();
        eq(url, 'http://localhost:3100/notebook/inject');
        const body = JSON.parse(opts.body);
        eq(body.message, 'note text');
        eq(body.notebookId, 'nb-123');
        eq(body.sender, 'gemini-notebook');
      });

      await test('sync: POSTs to /notebook/sync with the default account', async () => {
        const getCaptured = mockFetch({ synced: true });
        await client.sync();
        const { url, opts } = getCaptured();
        eq(url, 'http://localhost:3100/notebook/sync');
        eq(JSON.parse(opts.body).account, 'shawnru391@gmail.com');
      });

      await test('sync: honors a custom account argument', async () => {
        const getCaptured = mockFetch({ synced: true });
        await client.sync('someone@else.com');
        eq(JSON.parse(getCaptured().opts.body).account, 'someone@else.com');
      });

      await test('chat: calls the chat_with_newstate MCP tool with the given text', async () => {
        const getCaptured = mockFetch({ reply: 'hi' });
        const result = await client.chat('hello there');
        const { url, opts } = getCaptured();
        eq(url, 'http://localhost:3100/mcp/tools/call');
        const body = JSON.parse(opts.body);
        eq(body.name, 'chat_with_newstate');
        eq(body.arguments.text, 'hello there');
        eq(body.arguments.sender, 'gemini-notebook');
        eq(result.reply, 'hi');
      });

      await test('openStream: opens an EventSource against /mcp/sse and forwards parsed messages', () => {
        const created = [];
        global.EventSource = class {
          constructor(url) {
            created.push(url);
            this.url = url;
          }
        };
        const received = [];
        const es = client.openStream((data) => received.push(data));
        eq(created[0], 'http://localhost:3100/mcp/sse');
        es.onmessage({ data: JSON.stringify({ hello: 'world' }) });
        eq(received.length, 1);
        eq(received[0].hello, 'world');
      });

      await test('openStream: silently swallows malformed SSE payloads instead of throwing', () => {
        global.EventSource = class {
          constructor(url) { this.url = url; }
        };
        const received = [];
        const es = client.openStream((data) => received.push(data));
        es.onmessage({ data: 'not json' });
        eq(received.length, 0);
      });
    } finally {
      global.fetch = originalFetch;
      if (originalEventSource === undefined) {
        delete global.EventSource;
      } else {
        global.EventSource = originalEventSource;
      }
    }
  });
};