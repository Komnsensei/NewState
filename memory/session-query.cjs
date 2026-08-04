'use strict';

const fs = require('fs');
const path = require('path');

const SHADOW_RECORDS_FILE = path.join(__dirname, '..', 'memory-store', 'shadow-esma-history.jsonl');

async function querySessionPriorContext(options = {}) {
  const maxEvents = options.maxEvents || 500;
  const maxTokens = options.maxTokens || 300;

  if (!fs.existsSync(SHADOW_RECORDS_FILE)) {
    return { priorContext: '', sessionStats: {}, phraseHitRates: {} };
  }

  try {
    const lines = fs.readFileSync(SHADOW_RECORDS_FILE, 'utf8').split('\n').filter(Boolean);
    const recentLines = lines.slice(-maxEvents);
    const events = recentLines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    const targetEvents = events.filter(e => {
      try {
        const detail = JSON.parse(e.text);
        return ['GROUNDING_INTERVENTION', 'SHADOW_OBSERVATION', 'TRAJECTORY_INTERCEPT'].includes(detail.type);
      } catch {
        return false;
      }
    });

    const parsedDetails = targetEvents.map(e => JSON.parse(e.text));

    const categories = parsedDetails
      .filter(d => d.type === 'GROUNDING_INTERVENTION')
      .map(d => d.category)
      .filter(Boolean);
    const categoryCounts = {};
    categories.forEach(c => { categoryCounts[c] = (categoryCounts[c] || 0) + 1; });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    let priorContext = "FORENSIC_PRIOR_CONTEXT:\n";
    if (topCategories.length > 0) {
      priorContext += `Forensic log shows categories ${topCategories.join(', ')} triggered in recent sessions.\n`;
    }

    const driftEvents = parsedDetails.filter(d => d.type === 'TRAJECTORY_INTERCEPT');
    if (driftEvents.length > 0) {
      priorContext += `Trajectory intercepts recorded in ${driftEvents.length} of last ${maxEvents} events.\n`;
    }

    if (priorContext.length > maxTokens * 4) {
      priorContext = priorContext.slice(0, maxTokens * 4) + "...";
    }

    return {
      priorContext,
      sessionStats: { totalTargetEvents: targetEvents.length, topCategories },
      phraseHitRates: {}
    };
  } catch (err) {
    console.error("Error querying session prior context:", err);
    return { priorContext: '', sessionStats: {}, phraseHitRates: {} };
  }
}

module.exports = { querySessionPriorContext };
