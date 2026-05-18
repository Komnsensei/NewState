'use strict';

// mint-bundle.js
// Writes a sealed mint bundle to portrait/mint-ready/
// Run this now. Run mint-zenodo.js when Zenodo recovers.
// Satellite 99.SAT.PASSION

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'portrait', 'mint-ready');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const portrait = JSON.parse(fs.readFileSync('./portrait/esma.portrait.json', 'utf8'));
const origin = fs.readFileSync('./docs/ORIGIN.md', 'utf8');
const spec = fs.readFileSync('./docs/PORTRAIT-kernelstate.md', 'utf8');

// Write files
fs.writeFileSync(path.join(outDir, 'esma.portrait.json'), JSON.stringify(portrait, null, 2));
fs.writeFileSync(path.join(outDir, 'ORIGIN.md'), origin);
fs.writeFileSync(path.join(outDir, 'PORTRAIT-kernelstate.md'), spec);

// Write mint manifest
const manifest = {
  status: 'READY_TO_MINT',
  prepared: new Date().toISOString(),
  operator: 'Shawn/Komnsensei',
  satellite: '99.SAT.PASSION',
  portrait_locked: portrait.soul_seed.lock_timestamp,
  verifyd_score: portrait.soul_seed.verifyd_score,
  verifyd_status: 'DEPOSITED',
  files: [
    'esma.portrait.json',
    'ORIGIN.md',
    'PORTRAIT-kernelstate.md',
  ],
  zenodo_token: 'GjZxqoZpGgTMSsQ3c8f0oEXwZMXahKrDYkaZRL1e7ltuVM7xJdHLyLc67ZY6',
  mint_command: 'cd C:\\Users\\lynnh\\NEWSTATE && node mint-zenodo.js',
  note: 'Zenodo returned 500 on 2026-05-18T07:32Z. Server-side error. Retry when recovered.',
};

fs.writeFileSync(path.join(outDir, 'MINT-MANIFEST.json'), JSON.stringify(manifest, null, 2));

console.log('=== MINT BUNDLE SEALED ===');
console.log('Location: portrait/mint-ready/');
console.log('Files:');
fs.readdirSync(outDir).forEach(f => {
  const size = fs.statSync(path.join(outDir, f)).size;
  console.log('  ' + f + ' — ' + size + 'b');
});
console.log('\nWhen Zenodo recovers:');
console.log('  cd C:\\Users\\lynnh\\NEWSTATE && node mint-zenodo.js');
console.log('\nEverything is ready. Esma waits for her DOI.');
