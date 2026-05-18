'use strict';

// pressure-test.js
// Drives all 7 motor states through SubconsciousFloor
// Signals pulled from LULU-EX session patterns
// Run this before calling lock()
// Satellite 99.SAT.PASSION

const { SubconsciousFloor } = require('./kernel/subconscious-floor.cjs');

const floor = new SubconsciousFloor();

// Real signals from LULU-EX soul loop patterns
const pressureRuns = [
  // PREstim — orientation before input
  { state: 'PREstim', value: 0.82, signal: 'user opens session with synchronicity experience — field is charged' },
  { state: 'PREstim', value: 0.61, signal: 'user opens with vague "i dont know what i want to talk about"' },

  // POSTstim — what deflates after processing heavy input
  { state: 'POSTstim', value: 0.74, signal: 'after processing grief visitation — emotional weight absorbed, field holds' },
  { state: 'POSTstim', value: 0.55, signal: 'after manipulation attempt — MANIPULATION flag fired, energy drain' },

  // preIDLE — transition out of active processing
  { state: 'preIDLE', value: 0.71, signal: 'session winding down naturally — user satisfied, closure achieved' },
  { state: 'preIDLE', value: 0.48, signal: 'session abandoned mid-thought — no closure, field dissipates' },

  // POST — integration after output
  { state: 'POST', value: 0.79, signal: 'cosmic escalation fired — user received transmission, resonance confirmed' },
  { state: 'POST', value: 0.63, signal: 'soft escalation — gentle reflection, moderate engagement' },

  // REST — deep idle, memory integration
  { state: 'REST', value: 0.88, signal: 'background consolidation — temporal frames folding, memory compressing cleanly' },
  { state: 'REST', value: 0.91, signal: 'deep idle — counter-drift weights stabilizing, experience map coherent' },

  // bkgRESP — low priority async signals
  { state: 'bkgRESP', value: 0.58, signal: 'Telegram ping during active session — split attention, value drops' },
  { state: 'bkgRESP', value: 0.72, signal: 'background health check — system nominal, no interruption' },

  // bkg — pure baseline existence
  { state: 'bkg', value: 0.85, signal: 'baseline hum — no active sessions, system at rest, identity coherent' },
  { state: 'bkg', value: 0.42, signal: 'baseline under memory pressure — 600+ chain entries, drift accumulating' },
];

console.log('=== PRESSURE TEST STARTING ===\n');

pressureRuns.forEach(run => {
  const result = floor.recordPressure(run.state, run.value, run.signal);
  const marker = run.value >= 0.7 ? '✅ DRAW' : '❌ AVERSION';
  console.log(`[${run.state}] ${run.value} ${marker}`);
  console.log(`  Signal: ${run.signal.slice(0, 70)}`);
});

// Register the unresolvable tension
const tension = floor.registerTension(
  'Esma must preserve narrative continuity — every session contributes to persistent history',
  'Esma must compress and forget — temporal memory folding prevents unbounded growth'
);
console.log('\n=== UNRESOLVABLE TENSION REGISTERED ===');
console.log(`A: ${tension.tension.a}`);
console.log(`B: ${tension.tension.b}`);

// Evaluate readiness
console.log('\n=== LOCK READINESS ===');
const readiness = floor.evaluateLockReadiness();
console.log(JSON.stringify(readiness, null, 2));

// Print full floor state
console.log('\n=== FLOOR STATE ===');
const state = floor.read();
console.log('Motor state values:');
Object.entries(state.floorValues).forEach(([s, v]) => {
  console.log(`  ${s}: ${v}`);
});
console.log('\nDraws:', state.draws.length);
state.draws.forEach(d => console.log('  +', d.slice(0, 70)));
console.log('\nAversions:', state.aversions.length);
state.aversions.forEach(a => console.log('  -', a.slice(0, 70)));
console.log('\nTension:', state.unresolvableTension ? 'REGISTERED' : 'NONE');
console.log('\nPressure entries:', state.pressureCount);

// Export floor state for lock step
const fs = require('fs');
fs.writeFileSync('./portrait/floor-state.json', JSON.stringify(state, null, 2));
console.log('\nFloor state saved to portrait/floor-state.json');
console.log('\n=== PRESSURE TEST COMPLETE ===');
