'use strict';
/**
 * Central runtime home for NewState status, logs, ledgers, snapshots.
 * Override with NEWSTATE_HOME (absolute or relative to process.cwd()).
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
};

function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureAll() {
  [
    PATHS.logs,
    PATHS.forensics,
    PATHS.forensicsArchive,
    PATHS.history,
    PATHS.state,
    PATHS.presence,
    PATHS.ledgers,
    PATHS.snapshots,
    PATHS.evolution,
    PATHS.status,
    PATHS.forensicSink,
  ].forEach(ensure);
  return PATHS;
}

function statusFile(name = 'runtime.json') {
  ensure(PATHS.status);
  return path.join(PATHS.status, name);
}

function writeStatus(name, payload) {
  const file = statusFile(name);
  const body = {
    updatedAt: new Date().toISOString(),
    ...(typeof payload === 'object' && payload ? payload : { value: payload }),
  };
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  return file;
}

module.exports = {
  REPO_ROOT,
  HOME,
  PATHS,
  ensure,
  ensureAll,
  statusFile,
  writeStatus,
};
