'use strict';

const fs = require('fs');
const path = require('path');

const QIH_TELEMETRY_PATH = path.join(__dirname, '..', 'memory', 'qih-telemetry.jsonl');
const MAX_TELEMETRY_LINES = 1000; // Only process the last N lines for performance

class QIHMonitor {
  constructor() {
    this.telemetryHistory = [];
  }

  // Reads the last N lines of the telemetry file
  _loadTelemetry() {
    if (!fs.existsSync(QIH_TELEMETRY_PATH)) {
      this.telemetryHistory = [];
      return;
    }
    try {
      const lines = fs.readFileSync(QIH_TELEMETRY_PATH, 'utf8')
        .split('\n')
        .filter(Boolean)
        .slice(-MAX_TELEMETRY_LINES); // Keep only the most recent entries
      this.telemetryHistory = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error(`[QIH-Monitor] Error parsing telemetry line: ${e.message}`);
          return null;
        }
      }).filter(Boolean);
    } catch (e) {
      console.error(`[QIH-Monitor] Error reading telemetry file: ${e.message}`);
      this.telemetryHistory = [];
    }
  }

  // Performs an analysis of the telemetry data
  analyze() {
    this._loadTelemetry();
    if (this.telemetryHistory.length === 0) {
      return { status: 'NO_TELEMETRY', message: 'No QIH telemetry recorded yet.' };
    }

    const prunerEvents = this.telemetryHistory.filter(e => e.event === 'pruner_run');
    const integrityEvents = this.telemetryHistory.filter(e => e.event === 'integrity_check');

    // --- Pruner Analysis ---
    let totalS = 0;
    let totalWMin = 0;
    let totalPruneRatio = 0;
    let totalCritCount = 0;
    let highSCount = 0; // S > 3.0 (arbitrary high entropy threshold)
    let lowWMinCount = 0; // w_min < 1e-4 (aggressive pruning)

    prunerEvents.forEach(e => {
      totalS += e.S || 0;
      totalWMin += e.w_min || 0;
      totalPruneRatio += e.prune_ratio || 0;
      totalCritCount += e.crit_count || 0;
      if (e.S > 3.0) highSCount++;
      if (e.w_min < 1e-4) lowWMinCount++;
    });

    const avgS = prunerEvents.length > 0 ? totalS / prunerEvents.length : 0;
    const avgWMin = prunerEvents.length > 0 ? totalWMin / prunerEvents.length : 0;
    const avgPruneRatio = prunerEvents.length > 0 ? totalPruneRatio / prunerEvents.length : 0;
    const avgCritCount = prunerEvents.length > 0 ? totalCritCount / prunerEvents.length : 0;

    // --- Integrity Critic Analysis ---
    let totalStrain = 0;
    let highStrainCount = 0; // strain > 0.5 (arbitrary threshold)
    let totalViolations = 0;

    integrityEvents.forEach(e => {
      totalStrain += e.strain || 0;
      totalViolations += (e.violations && e.violations.length) || 0;
      if (e.strain > 0.5) highStrainCount++;
    });

    const avgStrain = integrityEvents.length > 0 ? totalStrain / integrityEvents.length : 0;
    const avgViolations = integrityEvents.length > 0 ? totalViolations / integrityEvents.length : 0;

    // --- BRO's Interpretations & Warnings ---
    const qihStatus = {
      pruner: {
        events: prunerEvents.length,
        avgS: avgS.toFixed(4),
        avgWMin: avgWMin.toExponential(2),
        avgPruneRatio: avgPruneRatio.toFixed(3),
        avgCritCount: avgCritCount.toFixed(1),
        highSEvents: highSCount,
        lowWMinEvents: lowWMinCount,
      },
      integrityCritic: {
        events: integrityEvents.length,
        avgStrain: avgStrain.toFixed(3),
        avgViolations: avgViolations.toFixed(1),
        highStrainEvents: highStrainCount,
      },
      overall: 'STABLE',
      warnings: []
    };

    if (highSCount > prunerEvents.length * 0.1) { // More than 10% of pruner events show high S
      qihStatus.warnings.push(`Sustained high entropy (S) detected in ${highSCount} of ${prunerEvents.length} pruner runs. Potential for semantic diffusion.`);
      qihStatus.overall = 'CAUTION';
    }
    if (lowWMinCount > prunerEvents.length * 0.1) { // More than 10% of pruner events show aggressive pruning
      qihStatus.warnings.push(`Aggressive pruning (low w_min) detected in ${lowWMinCount} of ${prunerEvents.length} pruner runs. Might indicate system stress or rapid adaptation.`);
      qihStatus.overall = 'CAUTION';
    }
    if (highStrainCount > integrityEvents.length * 0.05) { // More than 5% of integrity checks show high strain
      qihStatus.warnings.push(`Frequent high integrity strain detected in ${highStrainCount} of ${integrityEvents.length} integrity checks. Verify identity coherence.`);
      if (qihStatus.overall === 'CAUTION') qihStatus.overall = 'CRITICAL';
      else qihStatus.overall = 'CAUTION';
    }
    if (avgStrain > 0.3) { // High average strain
        qihStatus.warnings.push(`Average integrity strain is elevated (${avgStrain.toFixed(3)}). Consider re-evaluating core principles.`);
        if (qihStatus.overall === 'STABLE') qihStatus.overall = 'CAUTION';
    }
    if (prunerEvents.length === 0 && this.telemetryHistory.length > 0) {
      qihStatus.warnings.push('No pruner events recorded. Is the ClosedLoopGraphPruner active?');
      qihStatus.overall = 'CAUTION';
    }
    if (integrityEvents.length === 0 && this.telemetryHistory.length > 0) {
      qihStatus.warnings.push('No integrity critic events recorded. Is the Integrity Critic active?');
      qihStatus.overall = 'CAUTION';
    }
    if (this.telemetryHistory.length < 10 && prunerEvents.length < 1 && integrityEvents.length < 1) {
        qihStatus.warnings = ['QIH system is nascent. More data needed for meaningful analysis.'];
        qihStatus.overall = 'INITIALIZING';
    }


    return qihStatus;
  }

  // Public method to get a QIH status report
  getQIHStatus() {
    const report = this.analyze();
    console.log('\n--- BRO QIH Status Report ---');
    console.log(`Overall Status: ${report.overall}`);
    console.log('Pruner Metrics (last 1000 events):', JSON.stringify(report.pruner, null, 2));
    console.log('Integrity Critic Metrics (last 1000 events):', JSON.stringify(report.integrityCritic, null, 2));
    if (report.warnings.length > 0) {
      console.warn('QIH Warnings:');
      report.warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
    }
    console.log('-----------------------------\n');
    return report;
  }
}

module.exports = { QIHMonitor, qihMonitor: new QIHMonitor() };
