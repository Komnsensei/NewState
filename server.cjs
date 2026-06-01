'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const { runtime }   = require('./kernel/runtime-state.cjs');
const { forensics } = require('./kernel/forensics.cjs');
const chatRoutes    = require('./routes/chat-routes.cjs');
const { hexMemory } = require('./memory/hex-memory.cjs');
const continuityLoop = require('./kernel/continuity-loop.cjs');
const { modelClient } = require('./model/model-client.cjs');
const { telegramBot } = require('./integrations/telegram.cjs');

if (!process.env.GEMINI_API_KEY) {
  console.error('[NEWSTATE] FATAL: GEMINI_API_KEY not set. Refusing to start.');
  process.exit(2);
}

const app = express();
app.use(cors());

// ngrok browser-warning bypass — Telegram needs this to reach the webhook
app.use((_req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', '1');
  next();
});

app.use(express.json({ limit: '256kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.use('/', chatRoutes);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`[NEWSTATE] listening on :${PORT}`);
  console.log(`[NEWSTATE] provider=${modelClient.config.provider} model=${modelClient.config.model}`);
  console.log(`[NEWSTATE] safeMode=${runtime.flags.safeMode} personas=${runtime.flags.personasEnabled} memory=${runtime.flags.memoryEnabled}`);
  console.log(`[NEWSTATE] shadow flags: classifier=${runtime.flags.semanticClassifier} rotation=${runtime.flags.stabilizationRotation} governor=${runtime.flags.semanticGovernor}`);
  console.log(`[NEWSTATE] memory records loaded: ${hexMemory.count()}`);

  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const me = await telegramBot.getMe();
      if (me.ok) {
        console.log(`[NEWSTATE] telegram: @${me.result.username} (id:${me.result.id}) LIVE`);
        if (process.env.WEBHOOK_BASE_URL) {
          const wh = await telegramBot.setWebhook(`${process.env.WEBHOOK_BASE_URL}/telegram/webhook`);
          console.log(`[NEWSTATE] telegram webhook: ${wh.ok ? 'registered' : 'FAILED — ' + wh.description}`);
        }
      } else {
        console.log(`[NEWSTATE] telegram: token present but getMe failed — ${me.description || 'unknown'}`);
      }
    } catch (e) {
      console.log(`[NEWSTATE] telegram: init error — ${e.message}`);
    }
  } else {
    console.log('[NEWSTATE] telegram: no token — bot disabled');
  }
});

function shutdown(signal) {
  console.log(`[NEWSTATE] ${signal} received, shutting down...`);
  forensics.flush();
  server.close(() => {
    console.log('[NEWSTATE] closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server };
