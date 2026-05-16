'use strict';

const express = require('express');
const { kernel } = require('../kernel/kernel.cjs');
const { runtime } = require('../kernel/runtime-state.cjs');
const { trace } = require('../kernel/trace.cjs');
const { readBundle } = require('../kernel/snapshot.cjs');
const { replay, listSnapshots } = require('../kernel/replay.cjs');
const { forensics } = require('../kernel/forensics.cjs');
const { requireAdmin } = require('../kernel/auth.cjs');
const patterns = require('../kernel/audit/patterns.cjs');
const deltaReport = require('../kernel/audit/delta-report.cjs');

const router = express.Router();

// Public
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok: false, reason: 'missing-message' });
    }
    const result = await kernel.handle(message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'route-error', error: String(err && err.message || err) });
  }
});

router.get('/status', (_req, res) => {
  res.json({ ok: true, runtime: runtime.snapshot(), trace: trace.snapshot() });
});

// Admin
router.get('/snapshots', requireAdmin, (_req, res) => {
  res.json({ ok: true, snapshots: listSnapshots() });
});

router.get('/snapshots/:id', requireAdmin, (req, res) => {
  const bundle = readBundle(req.params.id);
  if (!bundle) return res.status(404).json({ ok: false, reason: 'not-found' });
  res.json({ ok: true, bundle });
});

router.post('/replay/:id', requireAdmin, async (req, res) => {
  const mode = req.query.mode === 'live'        ? 'live'
             : req.query.mode === 'comparative' ? 'comparative'
             : 'recorded';
  const samples = req.query.samples ? Number(req.query.samples) : undefined;
  const result = await replay(req.params.id, kernel, { mode, samples });
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
  const filters = {
    type:    req.query.type    || undefined,
    channel: req.query.channel || undefined,
    since:   req.query.since   ? Number(req.query.since) : undefined
  };
  res.json({ ok: true, ...patterns.analyze(filters) });
});

router.get('/audit/delta-report', requireAdmin, (req, res) => {
  const filters = {
    since: req.query.since ? Number(req.query.since) : undefined
  };
  res.json({ ok: true, report: deltaReport.generate(filters) });
});

module.exports = router;