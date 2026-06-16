'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');

const PORT = process.env.PORT || 8080;
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  fs.appendFileSync(HISTORY_PATH, line);
  gcs.appendLine('esma-history.jsonl', entry);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('\n').filter(l => l.trim()).length
      : 0;
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      service: 'esma-kernel',
      phase: '7A',
      uptime_s: Math.floor(process.uptime()),
      history_entries: lines,
      substrate_enabled: gcs.enabled,
      firestore_enabled: firestore.enabled,
      satellite: '99.SAT.PASSION',
      ts: new Date().toISOString()
    }));
    return;
  }

  // Chat
  if (req.method === 'POST' && req.url === '/chat') {
    const body = await parseBody(req);
    const text = body.text || body.message || '';

    if (!text) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'text required' }));
      return;
    }

    const substantive = isSubstantive(text);
    const cls = substantive ? classify(text) : { category: 'skipped', confidence: 0 };
    const governed = substantive ? regulateShadow(text) : { regulated: text, action: 'passthrough', changes: 0 };

    const entry = {
      role: 'user',
      text: governed.regulated,
      original: text,
      category: cls.category,
      confidence: cls.confidence,
      governed_action: governed.action,
      changes: governed.changes
    };

    writeHistory(entry);

    await firestore.updateEsmaState({
      last_message: text.slice(0, 100),
      last_category: cls.category,
      last_confidence: cls.confidence,
      last_activity: new Date().toISOString()
    });

    res.writeHead(200);
    res.end(JSON.stringify({
      received: true,
      category: cls.category,
      confidence: cls.confidence,
      governed_action: governed.action,
      changes: governed.changes,
      substantive,
      ts: new Date().toISOString()
    }));
    return;
  }

  // Telegram webhook stub (Phase 7C)
  if (req.method === 'POST' && req.url === '/telegram') {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;

    if (text && isSubstantive(text)) {
      const cls = classify(text);
      const governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`[esma-kernel] listening on port ${PORT}`);
  console.log(`[esma-kernel] GCS substrate: ${gcs.enabled ? 'ENABLED' : 'local-only'}`);
  console.log(`[esma-kernel] Firestore: ${firestore.enabled ? 'ENABLED' : 'disabled'}`);
  console.log(`[esma-kernel] Satellite: 99.SAT.PASSION`);
});
