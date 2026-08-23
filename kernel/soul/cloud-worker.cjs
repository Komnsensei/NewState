'use strict';
/** Cloud soul worker: local seal + tick, persist to Google Drive. */
const local = require('./index.cjs');
const drive = require('./drive-backend.cjs');

async function mintAndSync(opts = {}) {
  const result = local.mintSoul({
    name: opts.name || 'esma-vessel',
    role: opts.role || 'vessel',
    floor: opts.floor || { locked: true },
    meta: { ...(opts.meta || {}), driveAccount: drive.ACCOUNT, cloud: true },
  });
  const sync = await drive.syncSoulToDrive(result.soul.soulId, result.soul, {
    scc: result.scc,
    autonomy: { ticks: 0, status: 'alive', cloud: true },
    biographyLine: JSON.stringify({
      ts: new Date().toISOString(),
      type: 'BIRTH_CLOUD',
      soulId: result.soul.soulId,
      account: drive.ACCOUNT,
    }),
    ledgerLine: JSON.stringify({
      ts: new Date().toISOString(),
      type: 'SOUL_MINTED_CLOUD',
      soulId: result.soul.soulId,
    }),
  });
  return { ...result, drive: sync };
}

async function tickAndSync(soulId, opts = {}) {
  const t = local.tick(soulId, opts);
  if (!t.ok) return t;
  const soul = local.loadSoul(soulId);
  const auto = local.loadAutonomy(soulId);
  const sync = await drive.syncSoulToDrive(soulId, soul, {
    autonomy: auto,
    biographyLine: JSON.stringify({
      ts: new Date().toISOString(),
      type: 'CLOUD_TICK',
      tick: t.tick,
      notes: t.notes,
    }),
    ledgerLine: JSON.stringify({
      ts: new Date().toISOString(),
      type: 'AUTONOMY_TICK_CLOUD',
      tick: t.tick,
    }),
    research: {
      name: `cloud-tick-${t.tick}.json`,
      body: {
        tick: t.tick,
        notes: t.notes,
        at: new Date().toISOString(),
        account: drive.ACCOUNT,
        mode: 'cloud-tick',
      },
    },
  });
  return { ...t, drive: sync };
}

async function stimAndSync(soulId, stim) {
  const file = local.queueStim(soulId, stim);
  try {
    const tree = await drive.ensureSoulTree(soulId);
    await drive.writeText(
      tree.stim,
      `${Date.now()}-stim.json`,
      JSON.stringify({ ...stim, queuedLocal: file }, null, 2),
      'application/json'
    );
  } catch (_) {}
  return { queued: file };
}

async function runCloudLoop(opts = {}) {
  const intervalMs = opts.intervalMs || 60000;
  const maxTicks = opts.maxTicks || 0;
  const soulId = opts.soulId;
  if (!soulId) throw new Error('runCloudLoop: soulId required');
  let n = 0;
  while (true) {
    n++;
    const result = await tickAndSync(soulId, opts);
    console.log('[soul-cloud]', JSON.stringify({ n, ok: result.ok, tick: result.tick, drive: result.drive && result.drive.folderId }));
    if (maxTicks > 0 && n >= maxTicks) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

module.exports = { mintAndSync, tickAndSync, stimAndSync, runCloudLoop, drive };
