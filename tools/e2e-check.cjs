'use strict';
/**
 * End-to-end smoke check for the Esma kernel.
 * - starts server.cjs on an ephemeral port
 * - checks /health and /chat
 * - exercises kernel.handle() with a stubbed model client (no API key needed)
 * Usage: node tools/e2e-check.cjs
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8099;
const ROOT = path.join(__dirname, '..');

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')); });
  });
}

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  const server = spawn(process.execPath, ['server.cjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), ESMA_REPLY_PATH_ENABLED: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));

  // wait for listen
  let up = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try { const h = await get('/health'); if (h.status === 200) { up = true; break; } } catch (_) {}
  }

  const results = [];
  if (!up) {
    results.push({ name: 'server starts + /health', ok: false, detail: 'server never came up' });
  } else {
    const h = JSON.parse((await get('/health')).body);
    results.push({ name: 'server starts + /health', ok: true, detail: `phase=${h.phase} history=${h.history_entries}` });

    const c = JSON.parse((await post('/chat', { text: 'I feel like the system is waking up' })).body);
    results.push({ name: '/chat classify + regulate', ok: c.received === true, detail: `category=${c.category} conf=${c.confidence} action=${c.governed_action} changes=${c.changes}` });

    // kernel.handle with stubbed model — full pipeline
    const stub = require(path.join(ROOT, 'kernel/kernel.cjs'));
    const { modelClient } = require(path.join(ROOT, 'model/model-client.cjs'));
    const orig = modelClient.invoke;
    modelClient.invoke = async () => ({ text: 'I am here, grounded in the QIH substrate. How can I help?', contract: { provider: 'stub', temperature: 0 } });
    try {
      const out = await stub.kernel.handle('hello esma, are you there?', { sessionId: 'e2e-check' });
      results.push({ name: 'kernel.handle full pipeline', ok: out.ok === true && typeof out.message === 'string' && out.message.length > 0, detail: `requestId=${out.requestId} intercepted=${out.intercepted} coherence=${out.coherence} memoryFacts=${out.memoryFacts} floorLocked=${out.floorLocked}` });
    } catch (e) {
      results.push({ name: 'kernel.handle full pipeline', ok: false, detail: `threw: ${e.message}` });
    } finally {
      modelClient.invoke = orig;
    }
  }

  server.kill();
  console.log(JSON.stringify({ results, serverLogTail: log.split('\n').slice(-4).join(' | ') }, null, 2));
  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
