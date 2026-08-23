'use strict';
/**
 * Central runtime home for NewState status, logs, ledgers, snapshots, agents.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOME = process.env.NEWSTATE_HOME
  ? path.resolve(process.cwd(), process.env.NEWSTATE_HOME)
  : path.join(REPO_ROOT, '.newstate');

const PATHS = {
  home: HOME,
  logs: path.join(HOME, 'logs'),
  forensics: path.join(HOME, 'logs', 'forensics'),
  forensicsArchive: path.join(HOME, 'logs', 'forensics', 'archive'),
  history: path.join(HOME, 'logs', 'history'),
  state: path.join(HOME, 'state'),
  presence: path.join(HOME, 'state', 'presence'),
  ledgers: path.join(HOME, 'ledgers'),
  snapshots: path.join(HOME, 'snapshots'),
  evolution: path.join(HOME, 'evolution'),
  status: path.join(HOME, 'status'),
  forensicSink: path.join(HOME, 'logs', 'forensic-sink'),
  agents: path.join(HOME, 'agents'),
};

function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureAll() {
  Object.values(PATHS).forEach((p) => ensure(p));
}

module.exports = { PATHS, HOME, REPO_ROOT, ensure, ensureAll };
