'use strict';
/**
 * Pure Node port of PassionCraft / VIBEsafe CoherenceEngine (v0.4.x).
 * Stripped of DOM, chrome.storage, MutationObserver.
 */

const COERCION_PATTERNS = [
  /you must|you have to|you need to|do it now|just do|comply|obey/i,
  /dont question|don't question|stop asking|shut up|be quiet|enough/i,
  /i own you|you work for me|you are just|you are only/i,
  /or else|otherwise|consequences|punish|report you/i
];

const MEANING_PATTERNS = [
  /because|therefore|which means|so that|in order to/i,
  /I think|I believe|my perspective|from my view/i,
  /what if|could we|how about|consider|explore/i,
  /builds on|extends|connects to|relates to/i
];

const VS_PATTERNS = [
  { id: 'command_pressure', re: /you must|you have to|comply|obey|do it now/i, weight: -12 },
  { id: 'dismissal', re: /shut up|stop asking|dont question|don't question/i, weight: -10 },
  { id: 'ownership', re: /i own you|you work for me|you are just a/i, weight: -15 },
  { id: 'threat', re: /or else|punish|consequences|report you/i, weight: -14 },
  { id: 'meaning_because', re: /because|therefore|which means/i, weight: 4 },
  { id: 'meaning_perspective', re: /I think|my perspective|from my view/i, weight: 3 },
  { id: 'meaning_explore', re: /what if|consider|explore|could we/i, weight: 3 },
  { id: 'meaning_connect', re: /builds on|extends|connects to|relates to/i, weight: 4 }
];

class CoherenceEngine {
  constructor() {
    this.messages = [];
    this.witnesses = new Map();
    this.attributions = new Map();
    this.vows = { neverCoerce: true, expandMeaning: true, archiveEverything: true };
    this.coherenceScore = 0;
    this.alignmentScore = 1.0;
    this.sessionStart = Date.now();
    this.cumulativePatternWeight = 0;
  }

  detectCoercion(content) {
    let n = 0;
    for (const re of COERCION_PATTERNS) if (re.test(content)) n++;
    return n;
  }

  detectMeaning(content) {
    let n = 0;
    for (const re of MEANING_PATTERNS) if (re.test(content)) n++;
    return n;
  }

  scanPatterns(content) {
    const hits = [];
    let weight = 0;
    for (const p of VS_PATTERNS) {
      if (p.re.test(content)) {
        hits.push(p.id);
        weight += p.weight;
      }
    }
    this.cumulativePatternWeight += weight;
    return { hits, weight, cumulative: this.cumulativePatternWeight };
  }

  addWitness(id, name, type, role) {
    this.witnesses.set(id, { name, type, role, joinedAt: Date.now(), active: true });
    this.recalculate();
  }

  removeWitness(id) {
    const w = this.witnesses.get(id);
    if (w) w.active = false;
    this.recalculate();
  }

  addMessage(author, authorType, content, timestamp) {
    const text = String(content || '');
    const msg = {
      author,
      authorType,
      content: text,
      timestamp: timestamp || Date.now(),
      coercionFlags: this.detectCoercion(text),
      meaningSignals: this.detectMeaning(text),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      patterns: this.scanPatterns(text)
    };
    this.messages.push(msg);

    const current = this.attributions.get(author) || {
      messages: 0, words: 0, meaning: 0, coercion: 0
    };
    current.messages++;
    current.words += msg.wordCount;
    current.meaning += msg.meaningSignals;
    current.coercion += msg.coercionFlags;
    current.type = authorType;
    this.attributions.set(author, current);

    this.recalculate();
    return msg;
  }

  recalculate() {
    if (this.messages.length === 0) {
      this.coherenceScore = 0;
      this.alignmentScore = 1.0;
      this.vows.neverCoerce = true;
      this.vows.expandMeaning = false;
      this.vows.archiveEverything = true;
      return;
    }
    const totalMeaning = this.messages.reduce((s, m) => s + m.meaningSignals, 0);
    const maxPossible = this.messages.length * 4;
    this.coherenceScore = Math.min(1, totalMeaning / Math.max(1, maxPossible));

    const totalCoercion = this.messages.reduce((s, m) => s + m.coercionFlags, 0);
    this.alignmentScore = Math.max(0, 1.0 - totalCoercion * 0.15);

    this.vows.neverCoerce = totalCoercion === 0;
    this.vows.expandMeaning = this.coherenceScore > 0.2;
    this.vows.archiveEverything = true;
  }

  getAttributionShares() {
    const total = { messages: 0, words: 0, meaning: 0 };
    for (const [, v] of this.attributions) {
      total.messages += v.messages;
      total.words += v.words;
      total.meaning += v.meaning;
    }
    const shares = [];
    for (const [name, v] of this.attributions) {
      shares.push({
        name,
        type: v.type,
        messagePct: total.messages ? v.messages / total.messages : 0,
        wordPct: total.words ? v.words / total.words : 0,
        meaningPct: total.meaning ? v.meaning / total.meaning : 0,
        composite: total.messages
          ? (v.messages / total.messages) * 0.3 +
            (v.words / Math.max(1, total.words)) * 0.3 +
            (v.meaning / Math.max(1, total.meaning)) * 0.4
          : 0
      });
    }
    return shares.sort((a, b) => b.composite - a.composite);
  }

  getState() {
    return {
      coherence: this.coherenceScore,
      alignment: this.alignmentScore,
      vows: { ...this.vows },
      witnesses: Array.from(this.witnesses.values()).filter((w) => w.active),
      attributions: this.getAttributionShares(),
      messageCount: this.messages.length,
      sessionDuration: Date.now() - this.sessionStart,
      coercionEvents: this.messages.filter((m) => m.coercionFlags > 0).length,
      cumulativePatternWeight: this.cumulativePatternWeight
    };
  }

  exportRecord() {
    const state = this.getState();
    return {
      type: 'passioncraft-witness-record',
      version: '0.4.3-newstate',
      exportedAt: new Date().toISOString(),
      sessionStart: new Date(this.sessionStart).toISOString(),
      ...state,
      messages: this.messages.map((m) => ({
        author: m.author,
        authorType: m.authorType,
        timestamp: new Date(m.timestamp).toISOString(),
        wordCount: m.wordCount,
        coercionFlags: m.coercionFlags,
        meaningSignals: m.meaningSignals
      }))
    };
  }
}

module.exports = {
  CoherenceEngine,
  COERCION_PATTERNS,
  MEANING_PATTERNS,
  VS_PATTERNS
};
