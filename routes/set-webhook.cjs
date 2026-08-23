'use strict';
require('dotenv').config();
const { telegramBot } = require('../integrations/telegram.cjs');

const base = (process.env.WEBHOOK_BASE_URL || '').trim();
if (!base || /your-railway-domain|your-service-xxxx|your-app\.up\.railway|ngrok/i.test(base)) {
  console.error(
    'set-webhook: WEBHOOK_BASE_URL must be the deployed Google Cloud Run URL ' +
    '(project: passioncraft, e.g. https://your-service-xxxx-uc.a.run.app). ' +
    'Local tunnels like ngrok are for dev only — never point the production webhook at one.'
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
