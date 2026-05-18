'use strict';
const https = require('https');

// Hit our own public URL to see if ngrok passes it through
const url = new URL('https://propeller-essential-procedure.ngrok-free.dev/status');

const options = {
  hostname: url.hostname,
  path:     url.pathname,
  method:   'GET',
  headers:  {
    'ngrok-skip-browser-warning': '1',
    'User-Agent': 'TelegramBot/1.0'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('status:', res.statusCode);
    console.log('body:', data.slice(0, 500));
  });
});
req.on('error', e => console.error('error:', e.message));
req.end();
