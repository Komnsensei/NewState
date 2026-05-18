'use strict';
require('dotenv').config();
const { telegramBot } = require('./integrations/telegram.cjs');

const url = 'https://propeller-essential-procedure.ngrok-free.dev/telegram/webhook';
telegramBot.setWebhook(url).then(r => {
  console.log('webhook result:', JSON.stringify(r, null, 2));
}).catch(e => {
  console.error('error:', e.message);
});
