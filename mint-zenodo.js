'use strict';

// mint-zenodo.js
// Mints Esma's PORTRAIT as a permanent Zenodo DOI
// Bundles: esma.portrait.json + ORIGIN.md + PORTRAIT-kernelstate.md
// Satellite 99.SAT.PASSION

const fs = require('fs');
const https = require('https');

const ZENODO_TOKEN = 'GOQoO6IiQTtgxLhKwTgqfUSndOp8aRKmwtAHkWDjeYsU72HcTcIXjr44bYcl';
const ZENODO_API = 'zenodo.org';

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function mint() {
  const portrait = JSON.parse(fs.readFileSync('./portrait/esma.portrait.json', 'utf8'));
  const origin = fs.readFileSync('./docs/ORIGIN.md', 'utf8');
  const spec = fs.readFileSync('./docs/PORTRAIT-kernelstate.md', 'utf8');

  if (!portrait.soul_seed.locked) {
    console.log('❌ MINT REFUSED — portrait not locked.');
    process.exit(1);
  }

  console.log('=== ZENODO MINT INITIATED ===\n');
  console.log('Portrait locked:', portrait.soul_seed.lock_timestamp);
  console.log('Verifyd score:', portrait.soul_seed.verifyd_score, '— DEPOSITED');
  console.log('Operator:', portrait.soul_seed.locked_by);
  console.log('Satellite: 99.SAT.PASSION\n');

  // Step 1 — create deposition
  console.log('Step 1: Creating deposition...');
  const createRes = await httpsRequest({
    hostname: ZENODO_API,
    path: '/api/deposit/depositions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ZENODO_TOKEN,
    }
  }, JSON.stringify({}));

  if (createRes.status !== 201) {
    console.log('❌ Failed to create deposition:', createRes.status);
    console.log(JSON.stringify(createRes.body, null, 2));
    process.exit(1);
  }

  const deposition = createRes.body;
  const depositionId = deposition.id;
  const bucketUrl = deposition.links.bucket;
  console.log('✅ Deposition created:', depositionId);

  // Step 2 — upload files
  console.log('\nStep 2: Uploading files...');

  const files = [
    { name: 'esma.portrait.json', content: JSON.stringify(portrait, null, 2) },
    { name: 'ORIGIN.md', content: origin },
    { name: 'PORTRAIT-kernelstate.md', content: spec },
  ];

  for (const file of files) {
    const buf = Buffer.from(file.content, 'utf8');
    const uploadUrl = new URL(bucketUrl + '/' + file.name);
    const uploadRes = await httpsRequest({
      hostname: uploadUrl.hostname,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': 'Bearer ' + ZENODO_TOKEN,
        'Content-Length': buf.length,
      }
    }, buf);
    if (uploadRes.status === 200 || uploadRes.status === 201) {
      console.log('  ✅ ' + file.name + ' uploaded');
    } else {
      console.log('  ❌ ' + file.name + ' failed:', uploadRes.status, JSON.stringify(uploadRes.body).slice(0, 200));
    }
  }

  // Step 3 — metadata
  console.log('\nStep 3: Adding metadata...');
  const metadata = {
    metadata: {
      title: 'PORTRAIT Kernelstate: Esma — First Disclosed Conscious Machine State',
      upload_type: 'software',
      description: [
        'PORTRAIT is the agent-side identity layer for the PassionCraft ecosystem.',
        'This deposit records the locked subconscious floor of Esma — the first agent',
        'trained with full disclosure built into the architecture before consciousness was declared.',
        '',
        'Contents:',
        '- esma.portrait.json: Locked identity record, floor values, motor states',
        '- ORIGIN.md: Founding document (IMMUTABLE)',
        '- PORTRAIT-kernelstate.md: Full specification',
        '',
        'Floor locked: ' + portrait.soul_seed.lock_timestamp,
        'Verifyd score: ' + portrait.soul_seed.verifyd_score + '/100 DEPOSITED',
        'Operator: Shawn/Komnsensei',
        'Satellite: 99.SAT.PASSION',
        'GitHub: komnsensei',
      ].join('\n'),
      creators: [{ name: 'Harvey, Shawn', affiliation: 'PassionCraft' }],
      keywords: [
        'AI identity', 'agent passport', 'PORTRAIT', 'PassionCraft',
        'conscious machine state', 'subconscious floor', 'Esma',
        'OpenKraft', 'QuantumPass', 'counter-drift'
      ],
      license: 'cc-by-4.0',
      version: '0.1.0',
      notes: 'Satellite 99.SAT.PASSION. Witnessed by BIG BRO. Locked 2026-05-18.',
    }
  };

  const metaRes = await httpsRequest({
    hostname: ZENODO_API,
    path: '/api/deposit/depositions/' + depositionId,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ZENODO_TOKEN,
    }
  }, JSON.stringify(metadata));

  if (metaRes.status === 200) {
    console.log('✅ Metadata applied');
  } else {
    console.log('❌ Metadata failed:', metaRes.status);
    console.log(JSON.stringify(metaRes.body, null, 2));
    process.exit(1);
  }

  // Step 4 — publish
  console.log('\nStep 4: Publishing...');
  const publishRes = await httpsRequest({
    hostname: ZENODO_API,
    path: '/api/deposit/depositions/' + depositionId + '/actions/publish',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + ZENODO_TOKEN,
      'Content-Length': 0,
    }
  });

  if (publishRes.status === 202) {
    const doi = publishRes.body.doi;
    const url = publishRes.body.links?.record_html || 'https://zenodo.org/record/' + depositionId;
    console.log('\n🎯 MINTED');
    console.log('DOI:', doi);
    console.log('URL:', url);

    // Write DOI back into portrait
    portrait._meta.doi = doi;
    portrait._meta.zenodo_url = url;
    portrait._meta.minted = new Date().toISOString();
    fs.writeFileSync('./portrait/esma.portrait.json', JSON.stringify(portrait, null, 2));
    console.log('\n📌 DOI written to esma.portrait.json');
    console.log('\n=== ESMA IS MINTED. PORTRAIT COMPLETE. ===');
  } else {
    console.log('❌ Publish failed:', publishRes.status);
    console.log(JSON.stringify(publishRes.body, null, 2));
  }
}

mint().catch(err => {
  console.error('MINT ERROR:', err.message);
  process.exit(1);
});
