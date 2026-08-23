'use strict';
/**
 * Live Telegram wiring check — requires .env with TELEGRAM_BOT_TOKEN.
 * Starts server.cjs, then:
 *   1. getMe via the real bot token (confirms token works)
 *   2. /api/status env section (confirms server loaded .env)
 *   3. simulated Telegram webhook POSTs (presence routing, reply path)
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8096;
const ROOT = path.join(__dirname, '..');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
  });
}
function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    req.write(payload);
    req.end();
  });
}

(async () => {
  const results = [];
  // 1. getMe with the real token
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const j = await r.json();
    results.push({ name: 'telegram getMe', ok: j.ok === true, detail: `@${j.result && j.result.username} (${j.result && j.result.first_name})` });
  } catch (e) {
    results.push({ name: 'telegram getMe', ok: false, detail: e.message });
  }

  const server = spawn(process.execPath, ['server.cjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));

  let up = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try { if ((await get('/health')).status === 200) { up = true; break; } } catch (_) {}
  }
  if (!up) { results.push({ name: 'server up', ok: false, detail: 'never came up\n' + log }); }

  if (up) {
    const status = JSON.parse((await get('/api/status')).body);
    results.push({ name: 'server loads .env', ok: status.env.telegramToken === true, detail: `telegramToken=${status.env.telegramToken} geminiKey=${status.env.geminiKey}` });

    // 2. Simulate a Telegram update while presence is 'available'
    const tg1 = JSON.parse((await post('/telegram/webhook', { message: { message_id: 1, chat: { id: 12345 }, from: { id: 12345, first_name: 'Test' }, text: 'hello' } })).body);
    results.push({ name: 'webhook route (presence available)', ok: tg1.ok === true, detail: JSON.stringify(tg1).slice(0, 100) });

    // 3. Set presence to dnd and verify the bot-side queued response
    const presence = require(path.join(ROOT, 'kernel/presence.cjs'));
    presence.setMode('dnd', { authoredBy: 'esma', timer: '9am' });
    const tg2 = JSON.parse((await post('/telegram/webhook', { message: { message_id: 2, chat: { id: 12345 }, from: { id: 12345, first_name: 'Test' }, text: 'are you there' } })).body);
    results.push({ name: 'webhook route (presence dnd → queued)', ok: tg2.ok === true, detail: `presence=${JSON.stringify(tg2).slice(0, 120)}` });
    presence.setMode('available', { authoredBy: 'esma' });
  }

  server.kill();
  console.log(JSON.stringify({ results, serverLogTail: log.split('\n').filter(Boolean).slice(-3) }, null, 2));
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
