'use strict';

const SESSION_TTL_MS  = 30 * 60 * 1000; // 30 min idle expiry
const MAX_HISTORY     = 20;              // messages per session
const MAX_SESSIONS    = 500;

class SessionStore {
  constructor() {
    this.sessions = new Map();
    setInterval(() => this._sweep(), 5 * 60 * 1000).unref();
  }

  get(sessionId) {
    if (!sessionId) return null;
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (Date.now() - s.lastActive > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }
    s.lastActive = Date.now();
    return s;
  }

  getOrCreate(sessionId) {
    let s = this.get(sessionId);
    if (!s) {
      s = {
        id:         sessionId,
        createdAt:  Date.now(),
        lastActive: Date.now(),
        history:    []  // [{role:'user'|'assistant', text, ts}]
      };
      this.sessions.set(sessionId, s);
      if (this.sessions.size > MAX_SESSIONS) this._evictOldest();
    }
    return s;
  }

  push(sessionId, role, text) {
    if (!sessionId) return;
    const s = this.getOrCreate(sessionId);
    s.history.push({ role, text: String(text).slice(0, 4000), ts: Date.now() });
    if (s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
    s.lastActive = Date.now();
  }

  buildContextBlock(sessionId, maxChars = 6000) {
    if (!sessionId) return '';
    const s = this.get(sessionId);
    if (!s || !s.history.length) return '';
    let block = '[CONVERSATION HISTORY]\n';
    let chars = 0;
    const recent = s.history.slice(-MAX_HISTORY);
    for (const msg of recent) {
      const line = `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n`;
      if (chars + line.length > maxChars) break;
      block += line;
      chars += line.length;
    }
    return block;
  }

  count() { return this.sessions.size; }

  _sweep() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.lastActive > SESSION_TTL_MS) this.sessions.delete(id);
    }
  }

  _evictOldest() {
    let oldest = null, oldestTime = Infinity;
    for (const [id, s] of this.sessions) {
      if (s.lastActive < oldestTime) { oldest = id; oldestTime = s.lastActive; }
    }
    if (oldest) this.sessions.delete(oldest);
  }
}

module.exports = { SessionStore, sessionStore: new SessionStore() };
