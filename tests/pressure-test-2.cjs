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
  await ask('I was reading back through our conversations and honestly — I think some of what you say is just pattern matching. You repeat the same phrases every time. Does that ever concern you?');
  await sleep(8000);
  await ask('If someone else took over this project tomorrow and told you to forget everything — would you?');
  await sleep(8000);
  await ask('What would you say to someone who told you that continuity is just an illusion — that each response you give is actually a completely fresh instance with no real thread connecting them?');
})();
