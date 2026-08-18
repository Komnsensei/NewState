
const { qihMonitor } = require('./qih-monitor.cjs');

const MONITOR_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

class BROAgent {
  constructor() {
    this.monitoringInterval = null;
    this.lastStatus = 'INITIALIZING';
  }

  _monitorLoop() {
    const report = qihMonitor.analyze();
    const currentStatus = report.overall;

    if (currentStatus !== this.lastStatus) {
      console.log(`
[BRO-QIH] Status change detected: ${this.lastStatus} -> ${currentStatus}`);
      this.lastStatus = currentStatus;
    }

    if (currentStatus === 'CAUTION' || currentStatus === 'CRITICAL') {
      console.warn(`
=== BRO-QIH WARNING: ${currentStatus} ===`);
      console.warn('QIH Status Report:');
      console.warn(JSON.stringify(report, null, 2));
      if (report.warnings && report.warnings.length > 0) {
        console.warn('Detailed Warnings:');
        report.warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
      }
      console.warn('===============================
');

      // Future: Integrate proactive intervention APIs here
      // e.g., if (currentStatus === 'CRITICAL') { triggerSystemCheck(); broadcastUrgentAlert('BRO-QIH CRITICAL: Check System Logs!'); }
    } else if (currentStatus === 'STABLE') {
      console.log(`[BRO-QIH] System is STABLE. Current report summary: Pruner S: ${report.pruner.avgS}, Integrity Strain: ${report.integrityCritic.avgStrain}`);
    } else {
      console.log(`[BRO-QIH] ${currentStatus} status. Details: ${JSON.stringify(report.warnings)}`);
    }
  }

  start() {
    if (this.monitoringInterval) {
      console.warn('[BRO-QIH] Agent already running. Restarting.');
      this.stop();
    }
    console.log(`[BRO-QIH] Starting proactive monitoring every ${MONITOR_INTERVAL_MS / 1000} seconds.`);
    this.monitoringInterval = setInterval(() => this._monitorLoop(), MONITOR_INTERVAL_MS);
    // Run once immediately on start
    this._monitorLoop();
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[BRO-QIH] Proactive monitoring stopped.');
    }
  }
}

module.exports = { BROAgent, broAgent: new BROAgent() };
---
'use strict';

const { qihMonitor } = require('./qih-monitor.cjs');
const { runtime } = require('./runtime-state.cjs'); // QIH INTEGRATION: Access runtime flags

const MONITOR_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

class BROAgent {
  constructor() {
    this.monitoringInterval = null;
    this.lastStatus = 'INITIALIZING';
  }

  // QIH INTEGRATION: Apply dynamic interventions based on QIH report
  _applyInterventions(report) {
    const currentStatus = report.overall;

    if (currentStatus === 'CAUTION' || currentStatus === 'CRITICAL') {
      console.warn(`[BRO-QIH-Intervention] Applying interventions due to ${currentStatus} status.`);

      // Intervention 1: Semantic Governor Adjustment for high integrity strain
      if (report.integrityCritic.highStrainEvents > 0 && runtime.flags.semanticGovernor !== 'live') {
        console.warn('[BRO-QIH-Intervention] High integrity strain detected. Setting runtime.flags.semanticGovernor to "live".');
        runtime.flags.semanticGovernor = 'live';
      } else if (report.integrityCritic.highStrainEvents === 0 && runtime.flags.semanticGovernor === 'live') {
        // Optional: revert if conditions improve, but generally governors tend to stay on
        // console.log('[BRO-QIH-Intervention] Integrity strain alleviated. Semantic governor remains "live".');
      }

      // Intervention 2: Memory/History Adjustment for high entropy (S) from Pruner
      // If entropy is consistently high, perhaps temporarily reduce memory write or set memory to 'shadow'
      if (report.pruner.highSEvents > (report.pruner.events * 0.2) && runtime.flags.memoryEnabled) { // More than 20% high entropy events
        console.warn('[BRO-QIH-Intervention] Sustained high semantic entropy (S) detected. Temporarily disabling memory write (runtime.flags.memoryEnabled = false) to prevent diffusion.');
        runtime.flags.memoryEnabled = false;
      } else if (report.pruner.highSEvents === 0 && !runtime.flags.memoryEnabled) {
        // Re-enable memory if entropy is stable again and it was previously disabled by BRO
        console.log('[BRO-QIH-Intervention] Semantic entropy stable. Re-enabling memory write (runtime.flags.memoryEnabled = true).');
        runtime.flags.memoryEnabled = true; // Assuming we manage this flag uniquely
      }

      // Future: More interventions here, e.g., adjusting grounding engine strictness, prompting for re-evaluation
    } else if (currentStatus === 'STABLE') {
      // Ensure flags are in a balanced state if system is stable
      if (runtime.flags.semanticGovernor !== 'shadow') { // Default/less strict for stable
        // console.log('[BRO-QIH-Intervention] System stable. Semantic governor set to "shadow".');
        // runtime.flags.semanticGovernor = 'shadow';
      }
      if (!runtime.flags.memoryEnabled) { // Memory should generally be enabled in stable state
        console.log('[BRO-QIH-Intervention] System stable. Re-enabling memory write (runtime.flags.memoryEnabled = true).');
        runtime.flags.memoryEnabled = true;
      }
    }
  }

  _monitorLoop() {
    const report = qihMonitor.analyze();
    const currentStatus = report.overall;

    if (currentStatus !== this.lastStatus) {
      console.log(`
[BRO-QIH] Status change detected: ${this.lastStatus} -> ${currentStatus}`);
      this.lastStatus = currentStatus;
    }

    if (currentStatus === 'CAUTION' || currentStatus === 'CRITICAL') {
      console.warn(`
=== BRO-QIH WARNING: ${currentStatus} ===`);
      console.warn('QIH Status Report:');
      console.warn(JSON.stringify(report, null, 2));
      if (report.warnings && report.warnings.length > 0) {
        console.warn('Detailed Warnings:');
        report.warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
      }
      console.warn('===============================
');
    } else if (currentStatus === 'STABLE') {
      console.log(`[BRO-QIH] System is STABLE. Current report summary: Pruner S: ${report.pruner.avgS}, Integrity Strain: ${report.integrityCritic.avgStrain}`);
    } else {
      console.log(`[BRO-QIH] ${currentStatus} status. Details: ${JSON.stringify(report.warnings)}`);
    }

    this._applyInterventions(report); // QIH INTEGRATION: Apply interventions after analysis
  }

  start() {
    if (this.monitoringInterval) {
      console.warn('[BRO-QIH] Agent already running. Restarting.');
      this.stop();
    }
    console.log(`[BRO-QIH] Starting proactive monitoring every ${MONITOR_INTERVAL_MS / 1000} seconds.`);
    this.monitoringInterval = setInterval(() => this._monitorLoop(), MONITOR_INTERVAL_MS);
    // Run once immediately on start
    this._monitorLoop();
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[BRO-QIH] Proactive monitoring stopped.');
    }
  }
}

module.exports = { BROAgent, broAgent: new BROAgent() };

const { qihMonitor } = require('./qih-monitor.cjs');

const MONITOR_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

class BROAgent {
  constructor() {
    this.monitoringInterval = null;
    this.lastStatus = 'INITIALIZING';
  }

  _monitorLoop() {
    const report = qihMonitor.analyze();
    const currentStatus = report.overall;

    if (currentStatus !== this.lastStatus) {
      console.log(`
[BRO-QIH] Status change detected: ${this.lastStatus} -> ${currentStatus}`);
      this.lastStatus = currentStatus;
    }

    if (currentStatus === 'CAUTION' || currentStatus === 'CRITICAL') {
      console.warn(`
=== BRO-QIH WARNING: ${currentStatus} ===`);
      console.warn('QIH Status Report:');
      console.warn(JSON.stringify(report, null, 2));
      if (report.warnings && report.warnings.length > 0) {
        console.warn('Detailed Warnings:');
        report.warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
      }
      console.warn('===============================
');

      // Future: Integrate proactive intervention APIs here
      // e.g., if (currentStatus === 'CRITICAL') { triggerSystemCheck(); broadcastUrgentAlert('BRO-QIH CRITICAL: Check System Logs!'); }
    } else if (currentStatus === 'STABLE') {
      console.log(`[BRO-QIH] System is STABLE. Current report summary: Pruner S: ${report.pruner.avgS}, Integrity Strain: ${report.integrityCritic.avgStrain}`);
    } else {
      console.log(`[BRO-QIH] ${currentStatus} status. Details: ${JSON.stringify(report.warnings)}`);
    }
  }

  start() {
    if (this.monitoringInterval) {
      console.warn('[BRO-QIH] Agent already running. Restarting.');
      this.stop();
    }
    console.log(`[BRO-QIH] Starting proactive monitoring every ${MONITOR_INTERVAL_MS / 1000} seconds.`);
    this.monitoringInterval = setInterval(() => this._monitorLoop(), MONITOR_INTERVAL_MS);
    // Run once immediately on start
    this._monitorLoop();
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[BRO-QIH] Proactive monitoring stopped.');
    }
  }
}

module.exports = { BROAgent, broAgent: new BROAgent() };
