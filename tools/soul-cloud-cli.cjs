'use strict';
const cloud = require('../kernel/soul/cloud-worker.cjs');
const local = require('../kernel/soul');
const [cmd, ...rest] = process.argv.slice(2);

function usage() {
  console.log(`Soul Cloud CLI (Drive \u00b7 passioncraftai@gmail.com)

Env:
  GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON
  ESMA_DRIVE_FOLDER (or SOUL_DRIVE_FOLDER)

Commands:
  mint [--name N] [--role R]
  list | status
  tick <soulId>
  stim <soulId> <research|build|note> <text>
  loop <soulId> [intervalMs] [maxTicks]
`);
}

async function main() {
  if (!cmd || cmd === 'help') return usage();
  if (cmd === 'status') {
    console.log({
      account: cloud.drive.ACCOUNT,
      folder: cloud.drive.rootFolderId(),
      credsFile: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      credsJson: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
      localSouls: local.listSouls(),
    });
    return;
  }
  if (cmd === 'mint') {
    let name = 'esma-vessel', role = 'vessel';
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--name') name = rest[++i];
      if (rest[i] === '--role') role = rest[++i];
    }
    const r = await cloud.mintAndSync({ name, role });
    console.log(JSON.stringify({
      soulId: r.soul.soulId,
      birthHash: r.soul.birthHash,
      scc: r.scc && r.scc.status,
      drive: r.drive,
    }, null, 2));
    return;
  }
  if (cmd === 'list') return console.log(local.listSouls());
  if (cmd === 'tick') {
    const id = rest[0] || local.listSouls()[0];
    if (!id) throw new Error('no soulId');
    console.log(JSON.stringify(await cloud.tickAndSync(id), null, 2));
    return;
  }
  if (cmd === 'stim') {
    const [id, type, ...textParts] = rest;
    const text = textParts.join(' ');
    if (!id || !type) return usage();
    console.log(JSON.stringify(await cloud.stimAndSync(id, { type, text, query: text }), null, 2));
    return;
  }
  if (cmd === 'loop') {
    const id = rest[0];
    const intervalMs = Number(rest[1] || 30000);
    const maxTicks = Number(rest[2] || 3);
    if (!id) return usage();
    await cloud.runCloudLoop({ soulId: id, intervalMs, maxTicks });
    return;
  }
  usage();
}

main().catch((e) => {
  console.error('[soul-cloud]', e.message || e);
  process.exit(1);
});
