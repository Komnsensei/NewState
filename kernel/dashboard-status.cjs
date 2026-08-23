'use strict';
/**
 * dashboard-status.cjs — aggregates the whole NewState/Esma system into one
 * status object for the dashboard (/api/status). Pure reads, no side effects,
 * every section is wrapped so one failing source never breaks the endpoint.
 */
const fs = require('fs');
const path = require('path');

const { PATHS } = require('./newstate-paths.cjs');
const HISTORY_PATH = path.join(PATHS.history, 'esma-history.jsonl');

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback !== undefined ? fallback : { error: e.message }; }
}

function dirCount(dir) {
  try { return fs.readdirSync(dir).filter((f) => !f.startsWith('.')).length; } catch (e) { return 0; }
}

function readLastLines(file, n) {
  try {
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch { return { raw: l.slice(0, 120) }; } });
  } catch (e) { return []; }
}

function countLines(file) {
  try {
    if (!fs.existsSync(file)) return 0;
    let n = 0;
    const buf = fs.readFileSync(file, 'utf8');
    for (let i = 0; i < buf.length; i++) if (buf.charCodeAt(i) === 10) n++;
    return n;
  } catch (e) { return 0; }
}

function gitInfo() {
  try {
    const gitDir = path.join(__dirname, '..', '.git');
    const headRaw = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    let sha = headRaw;
    if (headRaw.startsWith('ref:')) {
      const ref = headRaw.slice(5).trim();
      sha = fs.readFileSync(path.join(gitDir, ref), 'utf8').trim();
    }
    return { branch: headRaw.replace('ref: ', '').replace(/^refs\/heads\//, ''), shortSha: sha.slice(0, 7), fullSha: sha };
  } catch (e) { return { error: 'no .git' }; }
}

function buildStatus() {
  const presence = safe(() => require('./presence.cjs'), null);
  const qihMonitor = safe(() => require('./qih-monitor.cjs'), null);
  const runtime = safe(() => require('./runtime-state.cjs').runtime, null);
  const hexMemory = safe(() => require('../memory/hex-memory.cjs').hexMemory, null);

  const presenceState = presence ? safe(() => ({ ...presence.getMode(), driveSync: presence.DRIVE_SYNC_ENABLED, window: presence.windowState() }), {}) : {};

  const qih = qihMonitor ? safe(() => qihMonitor.analyze(), null) : null;

  const history = readLastLines(HISTORY_PATH, 5);

  const env = {
    geminiKey: !!process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    telegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    replyPath: process.env.ESMA_REPLY_PATH_ENABLED !== 'false',
    brainProvider: process.env.BRAIN_PROVIDER || 'gemini',
    newstateHome: PATHS.home,
  };

  return {
    generatedAt: new Date().toISOString(),
    service: {
      phase: '8-sovereign-continuity',
      name: 'esma-kernel',
      historyEntries: countLines(HISTORY_PATH),
    },
    presence: presenceState,
    qih,
    runtime: runtime ? runtime.snapshot() : null,
    memory: hexMemory ? { facts: safe(() => hexMemory.count(), 0) } : null,
    storage: {
      snapshots: dirCount(PATHS.snapshots),
      forensics: dirCount(PATHS.forensics),
      ledgers: dirCount(PATHS.ledgers),
      agents: dirCount(path.join(PATHS.home, 'agents')),
      evolution: dirCount(PATHS.evolution),
    },
    git: gitInfo(),
    env,
    recentActivity: history,
    lastStatusFiles: safe(() => {
      const dir = PATHS.status;
      if (!fs.existsSync(dir)) return {};
      const out = {};
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).slice(-3)) {
        try { out[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) {}
      }
      return out;
    }, {}),
  };
}

module.exports = { buildStatus, HISTORY_PATH };
