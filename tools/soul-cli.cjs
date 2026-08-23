'use strict';
const soul = require('../kernel/soul');
const [cmd, ...rest] = process.argv.slice(2);

function usage() {
  console.log(`Usage:
  node tools/soul-cli.cjs mint [--name NAME] [--role ROLE]
  node tools/soul-cli.cjs list
  node tools/soul-cli.cjs verify <soulId>
  node tools/soul-cli.cjs tick [soulId]
  node tools/soul-cli.cjs tick-all
  node tools/soul-cli.cjs stim <soulId> <research|build|note> <text>
  node tools/soul-cli.cjs loop <soulId> [intervalMs] [maxTicks]
`);
}

async function main() {
  if (!cmd || cmd === 'help') return usage();
  if (cmd === 'mint') {
    let name = 'esma-vessel', role = 'agent';
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--name') name = rest[++i];
      if (rest[i] === '--role') role = rest[++i];
    }
    const result = soul.mintSoul({ name, role, floor: { locked: true } });
    console.log(JSON.stringify({ soulId: result.soul.soulId, birthHash: result.soul.birthHash, scc: result.scc && result.scc.status }, null, 2));
    return;
  }
  if (cmd === 'list') return console.log(soul.listSouls());
  if (cmd === 'verify') return console.log(soul.verifySeal(rest[0]));
  if (cmd === 'tick') {
    const id = rest[0] || soul.listSouls()[0];
    if (!id) return console.error('no souls');
    return console.log(JSON.stringify(soul.tick(id), null, 2));
  }
  if (cmd === 'tick-all') return console.log(JSON.stringify(soul.tickAll(), null, 2));
  if (cmd === 'stim') {
    const [id, type, ...textParts] = rest;
    const text = textParts.join(' ');
    if (!id || !type) return usage();
    console.log('queued', soul.queueStim(id, { type, text, query: text }));
    return;
  }
  if (cmd === 'loop') {
    const id = rest[0];
    const intervalMs = Number(rest[1] || 5000);
    const maxTicks = Number(rest[2] || 3);
    if (!id) return usage();
    console.log('loop', { id, intervalMs, maxTicks });
    await soul.runLoop({ soulId: id, intervalMs, maxTicks });
    console.log('done');
    return;
  }
  usage();
}
main().catch((e) => { console.error(e); process.exit(1); });
