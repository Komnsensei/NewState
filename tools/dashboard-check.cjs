'use strict';
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8097;
const ROOT = path.join(__dirname, '..');

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

(async () => {
  const server = spawn(process.execPath, ['server.cjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));

  let up = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try { if ((await get('/health')).status === 200) { up = true; break; } } catch (_) {}
  }

  if (!up) { console.error('server never came up\n' + log); server.kill(); process.exit(1); }

  const st = await get('/api/status');
  const status = JSON.parse(st.body);
  console.log('/api/status:', st.status, '| sections:', Object.keys(status).join(', '));
  console.log('  presence.mode:', status.presence && status.presence.mode);
  console.log('  qih:', status.qih && (status.qih.overall || status.qih.status));
  console.log('  runtime.requests:', status.runtime && status.runtime.metrics.requests);
  console.log('  env.geminiKey:', status.env.geminiKey, '| env.telegramToken:', status.env.telegramToken);
  console.log('  git:', status.git && status.git.branch + '@' + status.git.shortSha);

  const dash = await get('/dashboard');
  const htmlOk = dash.status === 200 && dash.body.includes('NEWSTATE') && dash.body.includes('api/status');
  console.log('/dashboard:', dash.status, '| serves page:', htmlOk, '| bytes:', dash.body.length);

  server.kill();
  process.exit(htmlOk && st.status === 200 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
