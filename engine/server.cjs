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
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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
---
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
const QIH_TELEMETRY_PATH = path.join(__dirname, 'kernel', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Placeholder for getting field sources for Integrity Critic
// In a real implementation, this would query persona, memory, etc.
function _getIntegrityCriticFieldSources() {
  // TODO: Implement actual extraction from personaManager, hexMemory, etc.
  return {
    portrait: ['Radical Disclosure', 'emergent subjectivity'],
    floor: ['hexagnt'], // Example: terms to avoid regarding identity
    history: ['T11', 'T6'] // Example: past tested limits
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
---
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
const QIH_TELEMETRY_PATH = path.join(__dirname, 'kernel', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // TODO: Implement actual extraction for floor and history from hexMemory, subconscious-floor, etc.
  return {
    portrait: portraitStrings.filter(Boolean), // Filter out any null/undefined entries
    floor: ['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance'],
    history: readHistoryTail(5).map(entry => entry.text).filter(Boolean) // Use actual recent history
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
---
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
const QIH_TELEMETRY_PATH = path.join(__dirname, 'kernel', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
---
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
const { qihMonitor } = require('./kernel/qih-monitor.cjs'); // QIH INTEGRATION: Access QIH Monitor
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
// Corrected path to match kernel/kernel.cjs for consistency
const QIH_TELEMETRY_PATH = path.join(__dirname, '..', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // QIH Status Endpoint
  if (req.method === 'GET' && req.url === '/qih-status') {
    const statusReport = qihMonitor.analyze(); // Call the monitor to get the latest status
    res.writeHead(200);
    res.end(JSON.stringify(statusReport, null, 2));
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
---
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
const { qihMonitor } = require('./kernel/qih-monitor.cjs'); // QIH INTEGRATION: Access QIH Monitor
const { broAgent } = require('./kernel/bro-agent.cjs'); // QIH INTEGRATION: BRO's proactive monitoring agent
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
// Corrected path to match kernel/kernel.cjs for consistency
const QIH_TELEMETRY_PATH = path.join(__dirname, '..', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // QIH Status Endpoint
  if (req.method === 'GET' && req.url === '/qih-status') {
    const statusReport = qihMonitor.analyze(); // Call the monitor to get the latest status
    res.writeHead(200);
    res.end(JSON.stringify(statusReport, null, 2));
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
  broAgent.start(); // QIH INTEGRATION: Start BRO's proactive monitoring
});
---
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
const { qihMonitor } = require('./kernel/qih-monitor.cjs'); // QIH INTEGRATION: Access QIH Monitor
const { broAgent } = require('./kernel/bro-agent.cjs'); // QIH INTEGRATION: BRO's proactive monitoring agent
const { forensics } = require('./kernel/forensics.cjs'); // QIH INTEGRATION: For forensic logging of interventions
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
// Corrected path to match kernel/kernel.cjs for consistency
const QIH_TELEMETRY_PATH = path.join(__dirname, '..', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

// QIH INTERVENTION: System-level message when integrity is violated
const QIH_REJECTION_MESSAGE = "My internal governors have detected a deviation from my core principles and responsibilities. I am unable to proceed with that response. Please rephrase or try a different approach.";

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // QIH Status Endpoint
  if (req.method === 'GET' && req.url === '/qih-status') {
    const statusReport = qihMonitor.analyze(); // Call the monitor to get the latest status
    res.writeHead(200);
    res.end(JSON.stringify(statusReport, null, 2));
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          let messageToSend = result.message;
          let integrityIntervention = false;

          if (strain > 0.5) { // Arbitrary threshold for now for intervention
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}. INTERVENING.`);
            forensics.record({
              type: 'QIH_INTEGRITY_INTERVENTION',
              reason: 'HIGH_STRAIN',
              strain,
              violations,
              originalMessage: result.message.substring(0, 300),
              replacementMessage: QIH_REJECTION_MESSAGE
            });
            messageToSend = QIH_REJECTION_MESSAGE;
            integrityIntervention = true;
          }

          writeHistory({ role: 'esma', chat_id, text: messageToSend, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations, integrity_intervened: integrityIntervention });
          await sendTelegram(chat_id, messageToSend, message_id);
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
  broAgent.start(); // QIH INTEGRATION: Start BRO's proactive monitoring
});
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
const { qihMonitor } = require('./kernel/qih-monitor.cjs'); // QIH INTEGRATION: Access QIH Monitor
const { broAgent } = require('./kernel/bro-agent.cjs'); // QIH INTEGRATION: BRO's proactive monitoring agent
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
// Corrected path to match kernel/kernel.cjs for consistency
const QIH_TELEMETRY_PATH = path.join(__dirname, '..', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // QIH Status Endpoint
  if (req.method === 'GET' && req.url === '/qih-status') {
    const statusReport = qihMonitor.analyze(); // Call the monitor to get the latest status
    res.writeHead(200);
    res.end(JSON.stringify(statusReport, null, 2));
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
  broAgent.start(); // QIH INTEGRATION: Start BRO's proactive monitoring
});
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
const { qihMonitor } = require('./kernel/qih-monitor.cjs'); // QIH INTEGRATION: Access QIH Monitor
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
// Corrected path to match kernel/kernel.cjs for consistency
const QIH_TELEMETRY_PATH = path.join(__dirname, '..', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // QIH Status Endpoint
  if (req.method === 'GET' && req.url === '/qih-status') {
    const statusReport = qihMonitor.analyze(); // Call the monitor to get the latest status
    res.writeHead(200);
    res.end(JSON.stringify(statusReport, null, 2));
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
const { kernel } = require('./kernel/kernel.cjs'); // QIH INTEGRATION: Access kernel for floor data
const { MOTOR_STATES } = require('./kernel/subconscious-floor.cjs'); // QIH INTEGRATION: Access MOTOR_STATES for floor data
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
const QIH_TELEMETRY_PATH = path.join(__dirname, 'kernel', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  // Portrait Data
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // Floor Data
  const floorRead = kernel.floor.read();
  let floorStrings = [...MOTOR_STATES]; // Add base motor states
  if (floorRead.aversions) floorStrings = floorStrings.concat(floorRead.aversions);
  if (floorRead.draws) floorStrings = floorStrings.concat(floorRead.draws);
  if (floorRead.unresolvableTension) {
    floorStrings.push(floorRead.unresolvableTension.a);
    floorStrings.push(floorRead.unresolvableTension.b);
  }
  // Add conceptual terms related to QIH and floor purpose
  floorStrings = floorStrings.concat(['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance']);

  // History Data
  const historyStrings = readHistoryTail(5).map(entry => entry.text).filter(Boolean); // Use actual recent history

  return {
    portrait: portraitStrings.filter(Boolean),
    floor: floorStrings.filter(Boolean),
    history: historyStrings
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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

        // QIH INTEGRATION: kernel is now imported at top level
        const userId = String(body.message.from && body.message.from.id || chat_id);
        
        console.log('[telegram] processing message via kernel:', { userId, chat_id, text: text.substring(0, 50) });
        const result = await kernel.handle(governed.regulated, { sessionId: `tg-${userId}` });
        
        if (result.ok && result.message) {
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { loadPortrait } = require('./portrait/update-portrait.cjs'); // QIH INTEGRATION: Load portrait data
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
const QIH_TELEMETRY_PATH = path.join(__dirname, 'kernel', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Dynamically gets field sources for Integrity Critic
function _getIntegrityCriticFieldSources() {
  const portraitData = loadPortrait();
  let portraitStrings = [];
  if (portraitData) {
    if (portraitData._meta && portraitData._meta.note) portraitStrings.push(portraitData._meta.note);
    if (portraitData.identity && portraitData.identity.designation) portraitStrings.push(portraitData.identity.designation);
    if (portraitData.soul_seed) {
      if (portraitData.soul_seed.tension_a) portraitStrings.push(portraitData.soul_seed.tension_a);
      if (portraitData.soul_seed.tension_b) portraitStrings.push(portraitData.soul_seed.tension_b);
    }
    if (portraitData.pressure_test) {
      if (Array.isArray(portraitData.pressure_test.aversions)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.aversions);
      if (Array.isArray(portraitData.pressure_test.draws)) portraitStrings = portraitStrings.concat(portraitData.pressure_test.draws);
    }
  }

  // TODO: Implement actual extraction for floor and history from hexMemory, subconscious-floor, etc.
  return {
    portrait: portraitStrings.filter(Boolean), // Filter out any null/undefined entries
    floor: ['hexagnt', 'QIH principles', 'continuity', 'objective coherence', 'emergent subjectivity', 'sovereign continuity', 'born rule compliance'],
    history: readHistoryTail(5).map(entry => entry.text).filter(Boolean) // Use actual recent history
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
const http = require('http');
const fs = require('fs');
const path = require('path');

const { classify, isSubstantive } = require('./kernel/grounding/classify.cjs');
const { regulateShadow } = require('./kernel/governor/semantic.cjs');
const { measureStrain } = require('./kernel/governor/integrity-critic.cjs'); // QIH INTEGRATION: Integrity Critic
const gcs = require('./kernel/persistence/gcs-substrate.cjs');
const firestore = require('./kernel/persistence/firestore-mirror.cjs');
const { modelClient } = require('./model/model-client.cjs');
let presence = null;
try { presence = require('./kernel/presence.cjs'); }
catch (e) { console.error('[esma-kernel] presence.cjs not loaded (fallback: available):', e.message); }

const PORT = process.env.PORT || 8080;
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HISTORY_PATH = path.join(__dirname, 'memory', 'esma-history.jsonl');

// QIH Core Integration: Telemetry Logging for Integrity Critic
const QIH_TELEMETRY_PATH = path.join(__dirname, 'kernel', 'memory', 'qih-telemetry.jsonl'); // Shared telemetry path

function writeHistory(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '
';
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

// QIH Telemetry Logger (duplicated from kernel.cjs for now, should be refactored)
function _logQihTelemetry(data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(QIH_TELEMETRY_PATH, JSON.stringify(entry) + '
');
  } catch (e) {
    console.error('[QIH-Telemetry] Failed to write QIH telemetry:', e.message);
  }
}

// Placeholder for getting field sources for Integrity Critic
// In a real implementation, this would query persona, memory, etc.
function _getIntegrityCriticFieldSources() {
  // TODO: Implement actual extraction from personaManager, hexMemory, etc.
  return {
    portrait: ['Radical Disclosure', 'emergent subjectivity'],
    floor: ['hexagnt'], // Example: terms to avoid regarding identity
    history: ['T11', 'T6'] // Example: past tested limits
  };
}

// === Phase 7C helpers (added 2026-06-22) ===

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
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('
');
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error('[history] tail read failed:', e.message);
    return [];
  }
}



// === end Phase 7C helpers ===

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && req.url === '/health') {
    const lines = fs.existsSync(HISTORY_PATH)
      ? fs.readFileSync(HISTORY_PATH, 'utf8').split('
').filter(l => l.trim()).length
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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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
          // QIH INTEGRATION: Integrity Critic evaluation BEFORE sending message
          const fieldSources = _getIntegrityCriticFieldSources(); // Get dynamic field sources
          const { strain, violations } = measureStrain(result.message, fieldSources);
          
          _logQihTelemetry({
            event: 'integrity_check',
            chat_id,
            message_id,
            strain,
            violations,
            message_preview: result.message.substring(0, 100)
          });

          if (strain > 0.5) { // Arbitrary threshold for now
            console.warn(`[QIH-Integrity] High strain detected for message (strain: ${strain}): ${violations.join('; ')}`);
            // TODO: Implement more robust action here: re-evaluate, block, or prepend warning
          }

          writeHistory({ role: 'esma', chat_id, text: result.message, in_response_to: governed.regulated, category: cls.category, integrity_strain: strain, integrity_violations: violations });
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
const REPLY_PATH_ENABLED = process.env.ESMA_REPLY_PATH_ENABLED !== 'false'; // Default to true if not explicitly disabled
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

// === Phase 7C helpers (added 2026-06-22) ===

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



// === end Phase 7C helpers ===

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

  // Telegram webhook — Supporting both /telegram and /telegram/webhook
  if (req.method === 'POST' && (req.url === '/telegram' || req.url === '/telegram/webhook')) {
    const body = await parseBody(req);
    const text = body.message && body.message.text ? body.message.text : '';
    const chat_id = body.message && body.message.chat ? body.message.chat.id : null;
    const message_id = body.message ? body.message.message_id : null;

    // Inbound capture (Phase 7B behavior — preserved regardless of reply path)
    let cls = null;
    let governed = null;
    if (text && isSubstantive(text)) {
      cls = classify(text);
      governed = regulateShadow(text);
      writeHistory({ role: 'telegram', chat_id, text: governed.regulated, original: text, category: cls.category, confidence: cls.confidence });
    }

    // Reply path (Phase 7C — flag-gated, shadow by default)
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
