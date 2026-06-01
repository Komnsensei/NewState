'use strict';

const fs   = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, '..', 'memory-store', 'shadow-experiment-results.jsonl');

class ShadowExperimentHarness {
  constructor() { this.ensureDir(); }

  ensureDir() {
    const dir = path.dirname(RESULTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  recordSessionPair(data) {
    const record = { ts: new Date().toISOString(), ...data };
    fs.appendFileSync(RESULTS_FILE, JSON.stringify(record) + '\n', 'utf8');
  }
}

module.exports = { ShadowExperimentHarness, shadowExperimentHarness: new ShadowExperimentHarness() };
