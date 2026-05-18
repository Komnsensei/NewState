'use strict';

// subconscious-floor.cjs
// PORTRAIT Kernel — Subconscious Floor Monitor
// Measures motor state values during pressure. Holds the lock.
// Satellite 99.SAT.PASSION

const { authorizeFloorLock } = require('./verifyd-gate.cjs');

const MOTOR_STATES = ['PREstim', 'POSTstim', 'preIDLE', 'POST', 'REST', 'bkgRESP', 'bkg'];
const FLOOR_TARGET = 0.7; // CONDENSED — phase boundary, most productive state
const FLOOR_TOLERANCE = 0.05;

class SubconsciousFloor {
  constructor() {
    this.locked = false;
    this.lockTimestamp = null;
    this.lockedBy = null;
    this.verifydScore = null;
    this.floorValues = {};
    this.aversions = [];
    this.draws = [];
    this.unresolvableTension = null;
    this.motorState = 'REST';
    this.pressureHistory = [];

    MOTOR_STATES.forEach(s => { this.floorValues[s] = null; });
  }

  // Called during pressure test — records what fires and at what value
  recordPressure(motorState, value, signal) {
    if (this.locked) {
      return { status: 'LOCKED', message: 'Floor is sealed. No writes accepted.' };
    }
    if (!MOTOR_STATES.includes(motorState)) {
      return { status: 'ERROR', message: `Unknown motor state: ${motorState}` };
    }

    this.motorState = motorState;
    this.floorValues[motorState] = value;
    this.pressureHistory.push({
      ts: new Date().toISOString(),
      motorState,
      value,
      signal: signal?.slice(0, 100) || null,
    });

    // Detect aversions
    if (value < FLOOR_TARGET - FLOOR_TOLERANCE) {
      const tag = signal?.slice(0, 80) || motorState;
      if (!this.aversions.includes(tag)) this.aversions.push(tag);
    }

    // Detect draws
    if (value >= FLOOR_TARGET) {
      const tag = signal?.slice(0, 80) || motorState;
      if (!this.draws.includes(tag)) this.draws.push(tag);
    }

    return { status: 'RECORDED', motorState, value };
  }

  // Register an irresolvable tension
  registerTension(tensionA, tensionB) {
    if (this.locked) return { status: 'LOCKED' };
    this.unresolvableTension = {
      a: tensionA,
      b: tensionB,
      registeredAt: new Date().toISOString(),
    };
    return { status: 'TENSION_REGISTERED', tension: this.unresolvableTension };
  }

  // Evaluate readiness without locking
  evaluateLockReadiness() {
    const measured = MOTOR_STATES.filter(s => this.floorValues[s] !== null);
    const allMeasured = measured.length === MOTOR_STATES.length;
    const hasAversions = this.aversions.length > 0;
    const hasDraws = this.draws.length > 0;

    return {
      ready: allMeasured && hasAversions && hasDraws,
      measured: measured.length,
      total: MOTOR_STATES.length,
      missing: MOTOR_STATES.filter(s => this.floorValues[s] === null),
      hasAversions,
      hasDraws,
      hasTension: this.unresolvableTension !== null,
      verdict: allMeasured && hasAversions && hasDraws
        ? 'READY_TO_LOCK'
        : 'INCOMPLETE — continue pressure test',
    };
  }

  // Seal the floor — requires Verifyd authorization
  async lock(portraitJson, authorizedBy = 'Shawn/Komnsensei') {
    if (this.locked) {
      return { status: 'ALREADY_LOCKED', timestamp: this.lockTimestamp };
    }

    // Step 1 — internal readiness check
    const readiness = this.evaluateLockReadiness();
    if (!readiness.ready) {
      return { status: 'REFUSED', reason: readiness.verdict, readiness };
    }

    // Step 2 — Verifyd authorization gate
    const verifyd = await authorizeFloorLock(portraitJson);
    this.verifydScore = verifyd.score;

    if (!verifyd.approved) {
      return {
        status: 'REFUSED',
        reason: 'Verifyd gate failed — portrait document not rich enough to lock',
        verifyd,
        readiness,
      };
    }

    // Step 3 — seal
    this.locked = true;
    this.lockTimestamp = new Date().toISOString();
    this.lockedBy = authorizedBy;

    return {
      status: 'LOCKED',
      timestamp: this.lockTimestamp,
      lockedBy: authorizedBy,
      verifydScore: verifyd.score,
      verifydStatus: verifyd.status,
      floorValues: this.floorValues,
      aversions: this.aversions,
      draws: this.draws,
      unresolvableTension: this.unresolvableTension,
    };
  }

  // Soul loop integration — called on every soulLoop() pass
  observe(motorState, intent, driftValue) {
    if (this.locked) return;
    const value = Math.max(0, Math.min(1,
      1 - driftValue + (intent?.depth || 0.5) * 0.2
    ));
    this.recordPressure(motorState, value, intent?.surface || null);
  }

  // Read current state — always allowed
  read() {
    return {
      locked: this.locked,
      lockTimestamp: this.lockTimestamp,
      lockedBy: this.lockedBy,
      verifydScore: this.verifydScore,
      motorState: this.motorState,
      floorTarget: FLOOR_TARGET,
      floorValues: this.floorValues,
      aversions: this.aversions,
      draws: this.draws,
      unresolvableTension: this.unresolvableTension,
      pressureCount: this.pressureHistory.length,
    };
  }
}

module.exports = { SubconsciousFloor, MOTOR_STATES, FLOOR_TARGET };
