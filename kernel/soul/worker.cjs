'use strict';
/** Soul autonomy worker — ticks without interactive commands. */
const store = require('./store.cjs');
const { verifySeal } = require('./mint.cjs');

function tick(soulId, opts = {}) {
  const soul = store.loadSoul(soulId);
  if (!soul) return { ok: false, reason: 'soul_missing' };
  if (!soul.sealed) return { ok: false, reason: 'soul_unsealed' };
  const seal = verifySeal(soulId);
  if (!seal.ok) return { ok: false, reason: 'seal_broken', seal };

  const stim = store.consumeStim(soulId);
  const auto = store.loadAutonomy(soulId);
  const tickNo = (auto.ticks || 0) + 1;
  const notes = [];

  for (const s of stim) {
    notes.push(`stim:${s.type || 'note'}`);
    store.appendBiography(soulId, { type: 'STIM_RECEIVED', stim: s, tick: tickNo });
    if (s.type === 'research' && (s.query || s.text)) {
      const q = s.query || s.text;
      store.saveResearch(soulId, `research-${tickNo}.json`, {
        query: q, tick: tickNo,
        note: 'Soul worker research stub — replace with live search/tools in later phases',
        at: new Date().toISOString(),
        constraints: { never_coerce: true, appendOnly: true, soulId },
      });
      store.appendBiography(soulId, { type: 'RESEARCH', query: q, tick: tickNo });
    }
    if (s.type === 'build' && (s.spec || s.text)) {
      store.saveArtifact(soulId, `build-${tickNo}.json`, {
        spec: s.spec || s.text, tick: tickNo,
        note: 'Soul worker build stub — artifact under sealed constraints',
        at: new Date().toISOString(),
      });
      store.appendBiography(soulId, { type: 'BUILD', tick: tickNo });
    }
  }

  if (stim.length === 0 && opts.heartbeat !== false) {
    store.saveResearch(soulId, `heartbeat-${tickNo}.json`, {
      tick: tickNo, status: 'heartbeat', soulId, name: soul.name,
      message: 'Autonomy tick — vessel persists; awaiting co-craft stimulation',
      at: new Date().toISOString(),
    });
    store.appendBiography(soulId, { type: 'HEARTBEAT', tick: tickNo });
    notes.push('heartbeat');
  }

  store.saveAutonomy(soulId, { ...auto, ticks: tickNo, lastTick: new Date().toISOString(), status: 'alive', lastNotes: notes });
  store.appendLedger(soulId, { type: 'AUTONOMY_TICK', tick: tickNo, stimCount: stim.length });
  return { ok: true, soulId, tick: tickNo, stimProcessed: stim.length, notes, seal: { ok: true, birthHash: soul.birthHash } };
}

function tickAll(opts = {}) {
  return store.listSouls().map((id) => {
    try { return tick(id, opts); }
    catch (e) { return { ok: false, soulId: id, reason: String(e.message || e) }; }
  });
}

async function runLoop(opts = {}) {
  const intervalMs = opts.intervalMs || 60000;
  const maxTicks = opts.maxTicks || 0;
  let n = 0;
  while (true) {
    n++;
    if (opts.soulId) tick(opts.soulId, opts);
    else tickAll(opts);
    if (maxTicks > 0 && n >= maxTicks) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

module.exports = { tick, tickAll, runLoop };
