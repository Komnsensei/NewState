'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
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

async function sendTelegram(chatId, text, replyToMessageId) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN unset, skipping sendMessage');
    return { ok: false, reason: 'no-token' };
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = { chat_id: chatId, text };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) console.error('[telegram] sendMessage non-200:', r.status, JSON.stringify(json));
    return { ok: r.ok, status: r.status, body: json };
  } catch (e) {
    console.error('[telegram] sendMessage threw:', e.message);
    return { ok: false, error: e.message };
  }
}

function readHistoryTail(n) {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('\n');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('\n').filter(l => l.trim()).length
      : 0;
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      service: 'esma-kernel',
      phase: '8-sovereign-continuity',
      uptime_s: Math.floor(process.uptime()),
      history_entries: lines,
      substrate_enabled: gcs.enabled,
      firestore_enabled: firestore.enabled,
      satellite: '99.SAT.PASSION',
      phase_8_components: {
        identity_governor: 'active',
        subconscious_floor: 'wired',
        welfare_monitor: 'monitoring',
        portrait_updates: 'enabled'
      },
      ts: new Date().toISOString()
    }));
    return;
  }

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

  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    if (REPLY_PATH_ENABLED && cls && chat_id) {
      try {
        const presenceResp = presence
          ? presence.telegramResponse(body.message)
          : { action: 'normal', responseHint: null };

        if (presenceResp.action !== 'normal') {
          if (presenceResp.responseHint) {
            await sendTelegram(chat_id, presenceResp.responseHint, message_id);
          }
          writeHistory({ role: 'esma', chat_id, text: presenceResp.responseHint, presence_mode: presenceResp.action, suppressed: true });
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, presence: presenceResp.action }));
          return;
        }

        const { kernel } = require('./kernel/kernel.cjs');
        const userId = String(body.message.from && body.message.from.id || chat_id);

        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });

        if (result.ok && result.message) {
          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category });
          await sendTelegram(chat_id, result.message, message_id);
        } else {
          console.error('[telegram] kernel failed or empty reply:', result.reason || 'no-message');
        }
      } catch (e) {
        console.error('[telegram] reply path error:', e.message, e.stack || '');
      }
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
