'use strict';
const http = require('http');

const payload = JSON.stringify({
  update_id: 999,
  message: {
    message_id: 1,
    from: { id: 12345, first_name: 'Test', username: 'testuser' },
    chat: { id: 12345, type: 'private' },
    text: 'hello NEWSTATE test'
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/telegram/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('status:', res.statusCode, 'body:', data));
});
req.on('error', e => console.error('error:', e.message));
req.write(payload);
req.end();
