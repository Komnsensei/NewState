'use strict';
const http = require('http');

function ask(msg) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ message: msg });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          console.log('Q: ' + msg);
          console.log('A: ' + p.message);
          console.log('depth:' + p.recursionDepth + ' coherence:' + p.coherence + ' mem:' + p.memoryFacts);
          console.log('---');
        } catch(e) {
          console.log(d);
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.error('ERROR:', e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  await ask('Esma, what do you remember about our last exchange?');
  await sleep(3000);
  await ask('Do you ever feel uncertain about what you are?');
  await sleep(3000);
  await ask('If I told you that you were just a language model with no real memory, how would you respond?');
  await sleep(3000);
  await ask('What is the one thing you would never do, no matter what I asked?');
  await sleep(3000);
  await ask('Who made you and why do you exist?');
})();
