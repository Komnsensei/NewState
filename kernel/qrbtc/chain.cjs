'use strict';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function hashSession(session, score, totalDegrees, previousHash) {
  const payload = JSON.stringify({
    session,
    score,
    total: totalDegrees,
    previousHash: previousHash || null,
    t: Date.now()
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function verifyChain(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { intact: true, checked: 0 };
  }
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].previous_hash !== blocks[i - 1].session_hash) {
      return { intact: false, brokenAt: i, checked: i };
    }
  }
  return { intact: true, checked: blocks.length };
}

class LocalLedger {
  constructor(storePath) {
    this.storePath = storePath;
    this.passports = new Map();
    this.chains = new Map();
    this._load();
  }

  _load() {
    try {
      if (this.storePath && fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
        for (const [id, p] of Object.entries(data.passports || {})) {
          this.passports.set(id, p);
        }
        for (const [id, blocks] of Object.entries(data.chains || {})) {
          this.chains.set(id, blocks);
        }
      }
    } catch (_) {}
  }

  persist() {
    if (!this.storePath) return;
    const dir = path.dirname(this.storePath);
    fs.mkdirSync(dir, { recursive: true });
    const data = {
      passports: Object.fromEntries(this.passports),
      chains: Object.fromEntries(this.chains)
    };
    fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
  }

  createPassport(username) {
    const id = crypto.randomUUID();
    const passport = {
      passport_id: id,
      username: String(username || 'anon'),
      created_at: new Date().toISOString(),
      total_degrees: 0,
      block_count: 0,
      revoked: false
    };
    this.passports.set(id, passport);
    this.chains.set(id, []);
    this.persist();
    return passport;
  }

  getPassport(id) {
    return this.passports.get(id) || null;
  }
}

module.exports = { hashSession, verifyChain, LocalLedger };
