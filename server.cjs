'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { runtime } = require('./kernel/runtime-state.cjs');
const { forensics } = require('./kernel/forensics.cjs');
const chatRoutes = require('./routes/chat-routes.cjs');

if (!process.env.GEMINI_API_KEY) {
  console.error('[openkraft-rev2] FATAL: GEMINI_API_KEY not set in environment.');
  console.error('[openkraft-rev2] Add it to .env. Refusing to start.');
  process.exit(2);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use('/', chatRoutes);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`[openkraft-rev2] listening on :${PORT}`);
  console.log(`[openkraft-rev2] provider=gemini model=${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`);
  console.log(`[openkraft-rev2] safeMode=${runtime.flags.safeMode} personas=${runtime.flags.personasEnabled} memory=${runtime.flags.memoryEnabled}`);
  console.log(`[openkraft-rev2] shadow flags: classifier=${runtime.flags.semanticClassifier} rotation=${runtime.flags.stabilizationRotation} governor=${runtime.flags.semanticGovernor}`);
});

function shutdown(signal) {
  console.log(`[openkraft-rev2] received ${signal}, shutting down...`);
  forensics.flush();
  server.close(() => {
    console.log('[openkraft-rev2] closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server };