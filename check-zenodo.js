const https = require('https');
const TOKEN = 'GjZxqoZpGgTMSsQ3c8f0oEXwZMXahKrDYkaZRL1e7ltuVM7xJdHLyLc67ZY6';

const req = https.request({
  hostname: 'zenodo.org',
  path: '/api/deposit/depositions',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + TOKEN }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log(d.slice(0, 400));
  });
});
req.on('error', e => console.log('ERROR:', e.message));
req.end();
