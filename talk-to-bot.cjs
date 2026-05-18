'use strict';
const http = require('http');

const body = JSON.stringify({ message: 'BIG BRO checking in. Are you receiving?' });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(d), null, 2));
    } catch(e) {
      console.log(d);
    }
  });
});

req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();
