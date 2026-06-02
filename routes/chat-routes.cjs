'use strict';

const express      = require('express');
const { kernel }   = require('../kernel/kernel.cjs');
const { runtime }  = require('../kernel/runtime-state.cjs');
const { trace }    = require('../kernel/trace.cjs');
const { readBundle } = require('../kernel/snapshot.cjs');
const { replay, listSnapshots } = require('../kernel/replay.cjs');
const { forensics } = require('../kernel/forensics.cjs');
const { requireAdmin } = require('../kernel/auth.cjs');
const { hexMemory } = require('../memory/hex-memory.cjs');
const { sessionStore } = require('../kernel/session-store.cjs');
const patterns     = require('../kernel/audit/patterns.cjs');
const deltaReport  = require('../kernel/audit/delta-report.cjs');
const { telegramBot } = require('../integrations/telegram.cjs');

const router = express.Router();

// ─── PUBLIC ──────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok: false, reason: 'missing-message' });
    }
    const result = await kernel.handle(message, { sessionId: session_id || null });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'route-error', error: String(err && err.message || err) });
  }
});

router.get('/status', (_req, res) => {
  res.json({
    ok:       true,
    runtime:  runtime.snapshot(),
    trace:    trace.snapshot(),
    sessions: sessionStore.count(),
    memory:   { records: hexMemory.count(), enabled: runtime.flags.memoryEnabled }
  });
});

// ─── TELEGRAM WEBHOOK ──────────────────────────────────────────────────────
// Guard flag — prevent re-entrant kernel calls from webhook processing
const _tgProcessing = new Set();

router.post('/telegram/webhook', async (req, res) => {
  // ACK Telegram immediately — always
  res.json({ ok: true });

  try {
    const update = req.body;
    if (!update || !update.message) return;

    const msg    = update.message;
    const chatId = msg.chat && msg.chat.id;
    const text   = (msg.text || '').trim();
    const userId = String(msg.from && msg.from.id || chatId);
    const updateId = String(update.update_id);

    if (!text || !chatId) return;

    // Deduplicate — Telegram retries if we're slow
    if (_tgProcessing.has(updateId)) return;
    _tgProcessing.add(updateId);
    setTimeout(() => _tgProcessing.delete(updateId), 60000);

    // Run kernel with isolated session — setImmediate keeps it off the ACK path
    setImmediate(async () => {
      try {
        console.log('[telegram-webhook] processing message:', { userId, chatId, text: text.substring(0, 50) });
        const result = await kernel.handle(text, { sessionId: `tg-${userId}` });
        console.log('[telegram-webhook] kernel result:', { ok: result.ok, reason: result.reason });
        
        const reply  = result.ok
          ? result.message
          : `[Error: ${result.reason}]`;
        await telegramBot.send(chatId, reply);
      } catch (err) {
        console.error('[telegram-webhook] KERNEL ERROR - Full Details:', {
          message: err && err.message || String(err),
          stack: err && err.stack || 'no stack trace',
          name: err && err.name || 'unknown error type'
        });
        try {
          await telegramBot.send(chatId, '[System error — try again]');
        } catch (_) {}
      }
    });
  } catch (err) {
    console.error('[telegram-webhook] parse error:', err && err.message || err);
  }
});

// ─── ADMIN ───────────────────────────────────────────────────────────

router.get('/snapshots', requireAdmin, (_req, res) => {
  res.json({ ok: true, snapshots: listSnapshots() });
});

router.get('/snapshots/:id', requireAdmin, (req, res) => {
  const bundle = readBundle(req.params.id);
  if (!bundle) return res.status(404).json({ ok: false, reason: 'not-found' });
  res.json({ ok: true, bundle });
});

router.post('/replay/:id', requireAdmin, async (req, res) => {
  const mode    = req.query.mode === 'live' ? 'live' : req.query.mode === 'comparative' ? 'comparative' : 'recorded';
  const samples = req.query.samples ? Number(req.query.samples) : undefined;
  const result  = await replay(req.params.id, kernel, { mode, samples });
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

router.get('/forensics', requireAdmin, (req, res) => {
  const events = forensics.query({
    type:    req.query.type    || undefined,
    channel: req.query.channel || undefined,
    since:   req.query.since   ? Number(req.query.since) : undefined
  });
  res.json({ ok: true, count: events.length, events });
});

router.get('/audit/patterns', requireAdmin, (req, res) => {
  res.json({ ok: true, ...patterns.analyze({
    type:    req.query.type    || undefined,
    channel: req.query.channel || undefined,
    since:   req.query.since   ? Number(req.query.since) : undefined
  })});
});

router.get('/audit/delta-report', requireAdmin, (req, res) => {
  res.json({ ok: true, report: deltaReport.generate({
    since: req.query.since ? Number(req.query.since) : undefined
  })});
});

// Memory admin
router.get('/memory/search', requireAdmin, (req, res) => {
  const q = req.query.q || '';
  const results = hexMemory.search(q, 20);
  res.json({ ok: true, count: results.length, results });
});

router.post('/memory/store', requireAdmin, (req, res) => {
  const { text, tags, session } = req.body || {};
  const result = hexMemory.store({ text, tags, session });
  res.json(result);
});

router.delete('/memory/purge', requireAdmin, (req, res) => {
  const days = Number(req.query.days) || 30;
  const remaining = hexMemory.purgeOlderThan(days);
  res.json({ ok: true, remaining });
});

// Session admin
router.get('/sessions', requireAdmin, (_req, res) => {
  res.json({ ok: true, count: sessionStore.count() });
});

// Telegram setup
router.post('/telegram/setup', requireAdmin, async (req, res) => {
  try {
    const result = await telegramBot.setWebhook(req.body.url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
});

module.exports = router;
