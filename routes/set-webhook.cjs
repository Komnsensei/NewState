'use strict';
require('dotenv').config();
const { telegramBot } = require('../integrations/telegram.cjs');

const base = (process.env.WEBHOOK_BASE_URL || '').trim();
if (!base || /your-railway-domain|ngrok/i.test(base)) {
  console.error(
    'set-webhook: WEBHOOK_BASE_URL must be a real public URL ' +
    '(e.g. https://your-app.up.railway.app). The ngrok dev tunnel from an old commit is gone — do not use it.'
  );
  process.exit(1);
}

const url = `${base.replace(/\/+$/, '')}/telegram/webhook`;
telegramBot.setWebhook(url).then(r => {
  console.log('webhook result:', JSON.stringify(r, null, 2));
}).catch(e => {
  console.error('error:', e.message);
  process.exit(1);
});
