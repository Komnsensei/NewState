'use strict';

// lock-floor.js
// Final lock sequence for Esma's subconscious floor
// Satellite 99.SAT.PASSION

const { SubconsciousFloor, MOTOR_STATES } = require('./kernel/subconscious-floor.cjs');
const fs = require('fs');
const path = require('path');

const portraitPath = path.join(__dirname, 'portrait', 'esma.portrait.json');
const floorStatePath = path.join(__dirname, 'portrait', 'floor-state.json');

const savedState = JSON.parse(fs.readFileSync(floorStatePath, 'utf8'));
const portrait = JSON.parse(fs.readFileSync(portraitPath, 'utf8'));

// Rebuild floor by injecting saved state directly
const floor = new SubconsciousFloor();

// Inject floor values by recording each state at its measured value
MOTOR_STATES.forEach(state => {
  const value = savedState.floorValues[state];
  if (value !== null && value !== undefined) {
    floor.recordPressure(state, value, `restored:${state}`);
  }
});

// Inject aversions and draws directly
floor.aversions = savedState.aversions;
floor.draws = savedState.draws;

// Re-register tension
if (savedState.unresolvableTension) {
  floor.unresolvableTension = savedState.unresolvableTension;
}

// Update portrait with full pressure test data before Verifyd scores it
portrait.pressure_test = {
  status: 'COMPLETE',
  aversions: savedState.aversions,
  draws: savedState.draws,
  unresolvable_tension: savedState.unresolvableTension,
  history_entries: savedState.pressureCount,
};
portrait.motor_states = savedState.floorValues;

console.log('=== LOCK SEQUENCE INITIATED ===\n');
console.log('Operator: Shawn/Komnsensei');
console.log('Satellite: 99.SAT.PASSION\n');
console.log('Readiness check:');
console.log(JSON.stringify(floor.evaluateLockReadiness(), null, 2));

// Fire lock — Verifyd gate runs inside
floor.lock(portrait, 'Shawn/Komnsensei').then(result => {
  console.log('\n=== VERIFYD GATE ===');
  console.log('Score:', result.verifydScore);
  console.log('Status:', result.verifydStatus);

  if (result.status !== 'LOCKED') {
    console.log('\n❌ LOCK REFUSED');
    console.log('Reason:', result.reason);
    if (result.verifyd) console.log('Verifyd:', JSON.stringify(result.verifyd, null, 2));
    process.exit(1);
  }

  console.log('\n✅ FLOOR LOCKED');
  console.log('Timestamp:', result.timestamp);
  console.log('Locked by:', result.lockedBy);

  // Seal portrait
  portrait.soul_seed.locked = true;
  portrait.soul_seed.lock_timestamp = result.timestamp;
  portrait.soul_seed.locked_by = result.lockedBy;
  portrait.soul_seed.verifyd_score = result.verifydScore;
  portrait.soul_seed.verifyd_status = result.verifydStatus;
  portrait._meta.status = 'LOCKED';
  portrait._meta.immutable = true;

  fs.writeFileSync(portraitPath, JSON.stringify(portrait, null, 2), 'utf8');

  console.log('\n📌 Portrait sealed.');
  console.log('\nFloor values:');
  Object.entries(result.floorValues).forEach(([s, v]) => {
    console.log(`  ${s}: ${v}`);
  });
  console.log('\nDraws:', result.draws.length);
  console.log('Aversions:', result.aversions.length);
  console.log('Tension: HELD');
  console.log('\n=== ESMA IS LOCKED ===');
  console.log('Next: mint Zenodo DOI');
});
