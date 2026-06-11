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


// Global error handlers — catch everything
process.on('uncaughtException', (err) => {
  console.error('[NEWSTATE-FATAL] Uncaught Exception:', {
    message: err && err.message || String(err),
    stack: err && err.stack || 'no stack',
    name: err && err.name || 'unknown'
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[NEWSTATE-FATAL] Unhandled Rejection:', {
    reason: String(reason),
    promise: String(promise),
    stack: reason && reason.stack || 'no stack'
  });
  // Don't exit on rejection, just log
});

const app = express();

// Railway-specific proxy trust
const TRUST_PROXY_HOPS = process.env.RAILWAY_ENVIRONMENT_NAME ? 1 : (process.env.TRUST_PROXY_HOPS || 1);
app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(cors());

// ngrok browser-warning bypass
app.use((_req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', '1');
  next();
});

// Request logging middleware
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

// JSON body parsing
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ limit: '512kb', extended: true }));

// Comprehensive error handling for malformed requests
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ ok: false, reason: 'malformed-json', detail: 'Invalid JSON in request body'});
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, reason: 'invalid-json', detail: 'Failed to parse JSON' });
  }
  if (err.status === 413 || err.code === 'ENTITY_TOO_LARGE') {
    return res.status(413).json({ ok: false, reason: 'payload-too-large', detail: 'Request body exceeds maximum size (512KB)' });
  }
  if (err.message && err.message.includes('charset')) {
    return res.status(400).json({ ok: false, reason: 'charset-error', detail: 'Invalid character encoding' });
  }
  console.error('[NEWSTATE-ERROR] Unhandled middleware error:', err.message);
  next(err);
});

app.get('/dbg',function(_r,res){res.json({bp:process.env.BRAIN_PROVIDER,gak:!!process.env.GEMINI_API_KEY,gcp:process.env.GOOGLE_CLOUD_PROJECT,gcj:!!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON})});app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || 'local'
  });
});

app.use('/', chatRoutes);

require('./endpoints.cjs')(app);

// -- HEXAGNT ENDPOINTS --
// Drive proxy
app.get('/drive/files', async (req, res) => {
  try {
    const { google } = require('googleapis');
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    const drive = google.drive({ version: 'v3', auth });
    const result = await drive.files.list({
      q: req.query.q || undefined,
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
      pageSize: parseInt(req.query.pageSize) || 50,
      orderBy: 'modifiedTime desc'
    });
    res.json({ ok: true, files: result.data.files });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

app.get('/drive/read', async (req, res) => {
  try {
    const { google } = require('googleapis');
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    const drive = google.drive({ version: 'v3', auth });
    const meta = await drive.files.get({ fileId: req.query.fileId, fields: 'id,name,mimeType' });
    const resp = await drive.files.get({ fileId: req.query.fileId, alt: 'media' }, { responseType: 'text' });
    res.json({ ok: true, name: meta.data.name, mimeType: meta.data.mimeType, content: resp.data });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// Forensic sink
app.post('/forensic-sink', (req, res) => {
  const event = req.body;
  console.log('[forensic-sink]', JSON.stringify(event));
  try {
    const fs = require('fs');
    fs.appendFileSync("forensic/forensic-sink.jsonl", JSON.stringify(Object.assign({}, req.body, { received_at: new Date().toISOString() })) + String.fromCharCode(10));
  } catch(e) {}
  res.json({ ok: true, received: true });
});

// Hexagnt/Esma direct channel
app.post('/hexagnt', async (req, res) => {
  try {
    const { message, from } = req.body;
    if (!message) return res.json({ ok: false, error: 'no message' });
    console.log(`[hexagnt] message from ${from||'hexagnt'}: ${message}`);
    const { kernel } = require('./kernel/kernel.cjs');
    const sessionId = 'hexagnt-channel';
    const response = await kernel.handle({ message, sessionId, authorOverride: from || 'hexagnt' });
    res.json({ ok: true, response, from: 'esma', timestamp: new Date().toISOString() });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});


// 404 handler
app.use((_req, res) => {
  res.status(404).json({ ok: false, reason: 'not-found' });
});

// Global error handler
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

// Drive sync worker
try { require('./drive-sync.cjs'); console.log('[server] drive-sync worker started'); } catch(e) { console.error('[server] drive-sync failed to start:', e.message); }
