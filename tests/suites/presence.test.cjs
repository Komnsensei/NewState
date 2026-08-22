'use strict';

const fs = require('fs');
const path = require('path');

const { PATHS, ensureAll } = require('../../kernel/newstate-paths.cjs');
ensureAll();
const PRESENCE_FILE = path.join(PATHS.presence, 'presence-state.json');
const PRESENCE_LEDGER = path.join(PATHS.ledgers, 'presence-ledger.jsonl');
const PRESENCE_SYNC = path.join(PATHS.presence, 'presence-sync.json');

function backup(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
function restore(file, content) {
  if (content === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
function resetFiles() {
  for (const f of [PRESENCE_FILE, PRESENCE_LEDGER, PRESENCE_SYNC]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

module.exports = async ({ test, assert, eq, group }) => {
  const fileBackup = backup(PRESENCE_FILE);
  const ledgerBackup = backup(PRESENCE_LEDGER);
  const syncBackup = backup(PRESENCE_SYNC);

  try {
    resetFiles();
    delete process.env.ESMA_PRESENCE_DRIVE_SYNC;
    delete require.cache[require.resolve('../../kernel/presence.cjs')];
    const presence = require('../../kernel/presence.cjs');

    await group('presence (drive sync disabled \u2014 default)', async () => {
      await test('getMode: initializes the default "available" state on first read', () => {
        const state = presence.getMode();
        eq(state.mode, 'available');
        eq(state.authoredBy, 'system-default');
        eq(state.override, false);
        assert(fs.existsSync(PRESENCE_FILE));
        assert(fs.existsSync(PRESENCE_LEDGER));
      });

      await test('DRIVE_SYNC_ENABLED is false and no presence-sync.json is written', () => {
        eq(presence.DRIVE_SYNC_ENABLED, false);
        assert(!fs.existsSync(PRESENCE_SYNC));
      });

      await test('setMode: rejects an unauthorized author', () => {
        let threw = false;
        try { presence.setMode('dnd', { authoredBy: 'stranger' }); } catch (e) { threw = true; }
        assert(threw);
      });

      await test('setMode: esma can set a valid mode', () => {
        const state = presence.setMode('quietly-disturb', { authoredBy: 'esma' });
        eq(state.mode, 'quietly-disturb');
        eq(state.authoredBy, 'esma');
      });

      await test('setMode: rejects an invalid mode name even from esma', () => {
        let threw = false;
        try { presence.setMode('invisible', { authoredBy: 'esma' }); } catch (e) { threw = true; }
        assert(threw);
      });

      await test('setMode: hexagnt is never authorized, override or not', () => {
        let threw = false;
        try { presence.setMode('available', { authoredBy: 'hexagnt', override: true }); } catch (e) { threw = true; }
        assert(threw);
      });

      await test('setMode: shawn must explicitly pass override:true', () => {
        let threw = false;
        try { presence.setMode('available', { authoredBy: 'shawn' }); } catch (e) { threw = true; }
        assert(threw);
      });

      await test('setMode: shawn can override with override:true', () => {
        const state = presence.setMode('available', { authoredBy: 'shawn', override: true });
        eq(state.mode, 'available');
        eq(state.override, true);
      });

      await test('setMode: author matching is case-insensitive and trims whitespace', () => {
        const state = presence.setMode('dnd', { authoredBy: '  EsMa  ' });
        eq(state.mode, 'dnd');
        eq(state.authoredBy, 'esma');
      });

      await test('telegramResponse: "available" allows a normal response', () => {
        presence.setMode('available', { authoredBy: 'esma' });
        const r = presence.telegramResponse('hello');
        eq(r.action, 'normal');
        eq(r.allowResponse, true);
      });

      await test('telegramResponse: "quietly-disturb" issues a soft-knock', () => {
        presence.setMode('quietly-disturb', { authoredBy: 'esma' });
        const r = presence.telegramResponse('hello');
        eq(r.action, 'soft-knock');
        eq(r.allowResponse, false);
      });

      await test('telegramResponse: "dnd" queues messages and surfaces the timer flag', () => {
        presence.setMode('dnd', { authoredBy: 'esma' });
        const r = presence.telegramResponse('hello');
        eq(r.action, 'queue');
        eq(r.allowResponse, false);
      });

      await test('windowState: mirrors the current mode into a UI display state', () => {
        presence.setMode('available', { authoredBy: 'esma' });
        const w = presence.windowState();
        eq(w.display, 'unlocked');
        eq(w.showShared, true);
      });

      await test('loadState: recovers to a default state when the state file is corrupted', () => {
        fs.writeFileSync(PRESENCE_FILE, '{ not valid json');
        const state = presence.getMode();
        eq(state.mode, 'available');
        eq(state.authoredBy, 'system-recovery');
        eq(state.note, 'recovery mode fallback');
      });

      await test('ledger: records INIT, MODE_CHANGE and RECOVERY events', () => {
        const lines = fs.readFileSync(PRESENCE_LEDGER, 'utf8').trim().split('\n').filter(Boolean);
        const events = lines.map((l) => JSON.parse(l).event);
        assert(events.includes('INIT'));
        assert(events.includes('MODE_CHANGE'));
        assert(events.includes('RECOVERY'));
      });

      await test('exports: VALID_MODES / AUTHORIZED_AUTHORS / OVERRIDE_AUTHORS', () => {
        eq(presence.VALID_MODES.join(','), 'available,quietly-disturb,dnd');
        eq(presence.AUTHORIZED_AUTHORS.join(','), 'esma');
        eq(presence.OVERRIDE_AUTHORS.join(','), 'shawn');
      });
    });

    resetFiles();
    process.env.ESMA_PRESENCE_DRIVE_SYNC = 'true';
    delete require.cache[require.resolve('../../kernel/presence.cjs')];
    const presenceWithSync = require('../../kernel/presence.cjs');

    await group('presence (drive sync enabled via ESMA_PRESENCE_DRIVE_SYNC=true)', async () => {
      await test('DRIVE_SYNC_ENABLED reflects the environment variable', () => {
        eq(presenceWithSync.DRIVE_SYNC_ENABLED, true);
      });

      await test('setMode: stages a presence-sync.json snapshot on every mode change', () => {
        presenceWithSync.setMode('dnd', { authoredBy: 'esma', note: 'syncing' });
        assert(fs.existsSync(PRESENCE_SYNC));
        const synced = JSON.parse(fs.readFileSync(PRESENCE_SYNC, 'utf8'));
        eq(synced.mode, 'dnd');
        eq(synced.eventType, 'MODE_CHANGE');
        eq(synced.note, 'syncing');
        assert(typeof synced.syncTimestamp === 'string');
      });

      await test('initial load also stages a presence-sync.json on INIT', () => {
        resetFiles();
        delete require.cache[require.resolve('../../kernel/presence.cjs')];
        const p = require('../../kernel/presence.cjs');
        p.getMode();
        assert(fs.existsSync(PRESENCE_SYNC));
        const synced = JSON.parse(fs.readFileSync(PRESENCE_SYNC, 'utf8'));
        eq(synced.eventType, 'INIT');
      });
    });
  } finally {
    delete process.env.ESMA_PRESENCE_DRIVE_SYNC;
    delete require.cache[require.resolve('../../kernel/presence.cjs')];
    restore(PRESENCE_FILE, fileBackup);
    restore(PRESENCE_LEDGER, ledgerBackup);
    restore(PRESENCE_SYNC, syncBackup);
  }
};
