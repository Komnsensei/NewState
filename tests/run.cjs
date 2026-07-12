'use strict';

// Test harness. Provides sandbox dirs, a tiny TAP-ish helper, and
// registers every suite in dependency order.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Tests use a dummy key. Real provider is never invoked during tests.
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'test-suite-dummy-key-do-not-use';
}

// Sandbox dirs so tests never touch real forensics/snapshots/replays.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'openkraft-test-'));
process.env.OPENKRAFT_FORENSICS_DIR = path.join(SANDBOX, 'forensics');
process.env.OPENKRAFT_SNAPSHOT_DIR  = path.join(SANDBOX, 'snapshots');
process.env.OPENKRAFT_REPLAY_DIR    = path.join(SANDBOX, 'replays');
fs.mkdirSync(process.env.OPENKRAFT_FORENSICS_DIR, { recursive: true });
fs.mkdirSync(process.env.OPENKRAFT_SNAPSHOT_DIR,  { recursive: true });
fs.mkdirSync(process.env.OPENKRAFT_REPLAY_DIR,    { recursive: true });

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  âœ“ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  âœ— ${name}`);
    console.log(`      ${err && err.message || err}`);
    console.log(err);
  }
}

async function group(name, fn) {
  console.log(`\n[${name}]`);
  await fn();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const helpers = { test, group, assert, eq };

const SUITES = [
  // Phase 1
  './suites/runtime-state.test.cjs',
  './suites/truth-frame.test.cjs',
  './suites/forensics.test.cjs',
  './suites/grounding.test.cjs',
  './suites/governor.test.cjs',
  './suites/persona-manager.test.cjs',
  './suites/memory-stub.test.cjs',
  './suites/prompt-builder.test.cjs',
  './suites/hooks.test.cjs',
  './suites/kernel.test.cjs',
  './suites/snapshot-replay.test.cjs',
  // Phase 2
  './suites/deep-freeze.test.cjs',
  './suites/schema-enforcement.test.cjs',
  './suites/snapshot-compression.test.cjs',
  // Phase 3
  './suites/determinism-contract.test.cjs',
  './suites/schema-migration.test.cjs',
  './suites/channel-split.test.cjs',
  './suites/replay-determinism.test.cjs',
  // Phase 4
  './suites/provider-gemini.test.cjs',
  './suites/redaction.test.cjs',
  './suites/model-client-construct.test.cjs',
  // Phase 5
  './suites/similarity.test.cjs',
  './suites/drift.test.cjs',
  './suites/drift_v02.test.cjs',
  './suites/stability.test.cjs',
  './suites/patterns.test.cjs',
  // Phase 6G
 // Phase 6G
  './suites/shadow-mode.test.cjs',
  './suites/classifier.test.cjs',
  './suites/stabilization-rotation.test.cjs',
    './suites/delta-report.test.cjs',
    './suites/phase-8.test.cjs'
  ];

(async () => {
  for (const suitePath of SUITES) {
    try {
      const suite = require(suitePath);
      await suite(helpers);
    } catch (e) {
      console.log(`Error in suite: ${suitePath}`);
      console.log(e);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.err && f.err.message || f.err}`);
    }
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('runner error:', e);
  process.exit(2);
});
