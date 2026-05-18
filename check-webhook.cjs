'use strict';
require('dotenv').config();
const https = require('https');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log('TOKEN present:', !!TOKEN);
const req = https.request({
  hostname: 'api.telegram.org',
  path: '/bot' + TOKEN + '/getWebhookInfo',
  method: 'GET'
}, r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => console.log(d));
});
req.end();
