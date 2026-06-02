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

// Railway-specific proxy trust: trust 1 hop from Railway's reverse proxy
// This ensures X-Forwarded-* headers are correctly parsed
const TRUST_PROXY_HOPS = process.env.RAILWAY_ENVIRONMENT_NAME ? 1 : (process.env.TRUST_PROXY_HOPS || 1);
app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(cors());

// ngrok browser-warning bypass – Telegram needs this to reach the webhook
app.use((_req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', '1');
  next();
});

// Request logging middleware for debugging
app.use((req, res, next) => {
  req.startTime = Date.now();
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    if (req.method === 'POST' && (req.path === '/telegram/webhook' || req.path === '/chat')) {
      console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`, {
        contentLength: req.headers['content-length'],
        remoteAddr: req.ip,
        forwarded: req.headers['x-forwarded-for']
      });
    }
    return originalSend.call(this, data);
  };
  next();
});

// JSON body parsing with increased buffer and better error handling
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ limit: '512kb', extended: true }));

// Comprehensive error handling for malformed requests
app.use((err, req, res, next) => {
  // SyntaxError from express.json() parser
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('[NEWSTATE-ERROR] JSON syntax error:', {
      path: req.path,
      method: req.method,
      message: err.message,
      status: err.status
    });
    return res.status(400).json({ 
      ok: false, 
      reason: 'malformed-json',
      detail: 'Invalid JSON in request body'
    });
  }

  // entity.parse.failed from older express versions
  if (err.type === 'entity.parse.failed') {
    console.error('[NEWSTATE-ERROR] JSON parse error:', {
      path: req.path,
      method: req.method,
      type: err.type
    });
    return res.status(400).json({ 
      ok: false, 
      reason: 'invalid-json',
      detail: 'Failed to parse JSON'
    });
  }

  // PayloadTooLarge
  if (err.status === 413 || err.code === 'ENTITY_TOO_LARGE') {
    console.error('[NEWSTATE-ERROR] Payload too large:', {
      path: req.path,
      contentLength: req.headers['content-length']
    });
    return res.status(413).json({ 
      ok: false, 
      reason: 'payload-too-large',
      detail: 'Request body exceeds maximum size (512KB)'
    });
  }

  // Charset issues
  if (err.message && err.message.includes('charset')) {
    console.error('[NEWSTATE-ERROR] Charset error:', {
      path: req.path,
      message: err.message
    });
    return res.status(400).json({ 
      ok: false, 
      reason: 'charset-error',
      detail: 'Invalid character encoding'
    });
  }

  // Pass unhandled errors to next middleware
  console.error('[NEWSTATE-ERROR] Unhandled middleware error:', err.message);
  next(err);
});

app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || 'local'
  });
});

app.use('/', chatRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ ok: false, reason: 'not-found' });
});

// Global error handler (catch-all for unhandled errors)
app.use((err, _req, res, _next) => {
  console.error('[NEWSTATE-FATAL]', {
    message: err.message,
    stack: err.stack
  });
  res.status(500).json({ 
    ok: false, 
    reason: 'internal-error',
    detail: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[NEWSTATE] listening on :${PORT}`);
  console.log(`[NEWSTATE] provider=${modelClient.config.provider} model=${modelClient.config.model}`);
  console.log(`[NEWSTATE] safeMode=${runtime.flags.safeMode} personas=${runtime.flags.personasEnabled} memory=${runtime.flags.memoryEnabled}`);
  console.log(`[NEWSTATE] shadow flags: classifier=${runtime.flags.semanticClassifier} rotation=${runtime.flags.stabilizationRotation} governor=${runtime.flags.semanticGovernor}`);
  console.log(`[NEWSTATE] memory records loaded: ${hexMemory.count()}`);
  console.log(`[NEWSTATE] trust proxy hops: ${TRUST_PROXY_HOPS}`);

  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const me = await telegramBot.getMe();
      if (me.ok) {
        console.log(`[NEWSTATE] telegram: @${me.result.username} (id:${me.result.id}) LIVE`);
        if (process.env.WEBHOOK_BASE_URL) {
          const wh = await telegramBot.setWebhook(`${process.env.WEBHOOK_BASE_URL}/telegram/webhook`);
          console.log(`[NEWSTATE] telegram webhook: ${wh.ok ? 'registered' : 'FAILED — ' + wh.description}`);
        } else {
          console.warn('[NEWSTATE] telegram: WEBHOOK_BASE_URL not set — webhook not registered');
        }
      } else {
        console.log(`[NEWSTATE] telegram: token present but getMe failed — ${me.description || 'unknown'}`);
      }
    } catch (e) {
      console.error(`[NEWSTATE] telegram: init error — ${e.message}`);
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
