'use strict';

const fs = require('fs');
const path = require('path');

const SHADOW_FILE = path.join(__dirname, '..', 'memory-store', 'shadow-esma-history.jsonl');

class ShadowMemoryHarness {
  constructor() {
    this.ensureDir();
  }

  ensureDir() {
    const dir = path.dirname(SHADOW_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  write(event) {
    const record = {
      ts: new Date().toISOString(),
      type: 'SHADOW_MEMORY_WRITE',
      text: JSON.stringify(event)
    };
    fs.appendFileSync(SHADOW_FILE, JSON.stringify(record) + '\n', 'utf8');
  }

  read(maxLines = 500) {
    if (!fs.existsSync(SHADOW_FILE)) return [];
    try {
      return fs.readFileSync(SHADOW_FILE, 'utf8')
        .split('\n').filter(Boolean)
        .slice(-maxLines)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
    } catch { return []; }
  }
}

module.exports = { ShadowMemoryHarness, shadowMemoryHarness: new ShadowMemoryHarness() };
