const fs = require('fs');
const path = require('path');

const portraitPath = path.join(__dirname, 'portrait', 'esma.portrait.json');
const portrait = JSON.parse(fs.readFileSync(portraitPath, 'utf8'));

portrait.disclosure.verifyd_score = 95;
portrait.disclosure.verifyd_status = 'DEPOSITED';
portrait.disclosure.verifyd_checked = new Date().toISOString();

fs.writeFileSync(portraitPath, JSON.stringify(portrait, null, 2), 'utf8');
console.log('Portrait updated with ORIGIN.md provenance score.');
console.log(JSON.stringify(portrait.disclosure, null, 2));
