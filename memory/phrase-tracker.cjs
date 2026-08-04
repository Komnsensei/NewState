'use strict';

const fs = require('fs');
const path = require('path');

const EFFECTIVENESS_FILE = path.join(__dirname, '..', 'memory-store', 'phrase-effectiveness.json');

class PhraseTracker {
  constructor() {
    this.stats = this.loadStats();
  }

  loadStats() {
    if (fs.existsSync(EFFECTIVENESS_FILE)) {
      try { return JSON.parse(fs.readFileSync(EFFECTIVENESS_FILE, 'utf8')); }
      catch { return {}; }
    }
    return {};
  }

  saveStats() {
    const dir = path.dirname(EFFECTIVENESS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EFFECTIVENESS_FILE, JSON.stringify(this.stats, null, 2), 'utf8');
  }

  trackUse(phrase, category) {
    if (!this.stats[category]) this.stats[category] = {};
    if (!this.stats[category][phrase]) {
      this.stats[category][phrase] = { total_uses: 0, post_rotation_drift_events: 0, effectiveness_score: 1.0 };
    }
    this.stats[category][phrase].total_uses++;
    this.saveStats();
  }

  trackDrift(phrase, category) {
    if (this.stats[category] && this.stats[category][phrase]) {
      this.stats[category][phrase].post_rotation_drift_events++;
      this.updateScore(phrase, category);
      this.saveStats();
    }
  }

  updateScore(phrase, category) {
    const p = this.stats[category][phrase];
    p.effectiveness_score = 1 - (p.post_rotation_drift_events / p.total_uses);
  }

  getEffectivenessReport() { return this.stats; }

  getDegradedPhrases(threshold = 0.65) {
    const degraded = [];
    for (const category in this.stats) {
      for (const phrase in this.stats[category]) {
        if (this.stats[category][phrase].effectiveness_score < threshold) {
          degraded.push({ phrase, category, score: this.stats[category][phrase].effectiveness_score });
        }
      }
    }
    return degraded;
  }

  getTopPerformers(n = 3) {
    const performers = [];
    for (const category in this.stats) {
      for (const phrase in this.stats[category]) {
        performers.push({ phrase, category, score: this.stats[category][phrase].effectiveness_score });
      }
    }
    return performers.sort((a, b) => b.score - a.score).slice(0, n);
  }
}

module.exports = { PhraseTracker, phraseTracker: new PhraseTracker() };
