'use strict';

// gen-entropy.js
// Generates cryptographic entropy signature for Esma's locked floor
// Hash of: floor values + lock timestamp + operator + satellite
// Satellite 99.SAT.PASSION

const crypto = require('crypto');
const fs = require('fs');

const portrait = JSON.parse(fs.readFileSync('./portrait/esma.portrait.json', 'utf8'));

if (!portrait.soul_seed.locked) {
  console.log('❌ Portrait not locked. Run lock-floor.js first.');
  process.exit(1);
}

// The entropy input — exact measured values, immutable facts only
const entropyInput = {
  floor_values: portrait.motor_states,
  lock_timestamp: portrait.soul_seed.lock_timestamp,
  locked_by: portrait.soul_seed.locked_by,
  verifyd_score: portrait.soul_seed.verifyd_score,
  satellite: portrait._meta.satellite,
  tension_a: portrait.pressure_test.unresolvable_tension.a,
  tension_b: portrait.pressure_test.unresolvable_tension.b,
  aversion_count: portrait.pressure_test.aversions.length,
  draw_count: portrait.pressure_test.draws.length,
  history_entries: portrait.pressure_test.history_entries,
};

const entropyString = JSON.stringify(entropyInput, null, 0);
const signature = crypto.createHash('sha256').update(entropyString).digest('hex');
const shortSig = signature.slice(0, 16);

console.log('=== ENTROPY SIGNATURE GENERATION ===\n');
console.log('Input material:');
console.log(JSON.stringify(entropyInput, null, 2));
console.log('\nEntropy string:');
console.log(entropyString);
console.log('\nSHA-256:', signature);
console.log('Short ID:', shortSig);

// Write into portrait
portrait.soul_seed.entropy_signature = signature;
portrait.soul_seed.entropy_short = shortSig;
portrait.soul_seed.entropy_generated = new Date().toISOString();
portrait.soul_seed.entropy_input = entropyInput;

fs.writeFileSync('./portrait/esma.portrait.json', JSON.stringify(portrait, null, 2));

// Also update mint-ready bundle
const mintReadyPath = './portrait/mint-ready/esma.portrait.json';
if (fs.existsSync(mintReadyPath)) {
  fs.writeFileSync(mintReadyPath, JSON.stringify(portrait, null, 2));
  console.log('\n📌 Mint bundle updated.');
}

console.log('\n✅ Entropy signature written to esma.portrait.json');
console.log('\nEsma\'s fingerprint:', shortSig);
console.log('\n=== ESMA IS FINGERPRINTED ===');
console.log('entropy_signature: null → CLOSED');
console.log('Next: eval suite');
