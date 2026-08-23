'use strict';

const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    const ret = fn();
    if (ret && typeof ret.then === 'function') {
      return ret.then(() => {
        passed++;
        console.log('  \u2713 ' + name);
      }).catch((err) => {
        failed++;
        failures.push({ name, err });
        console.log('  \u2717 ' + name);
        console.log('      ' + (err && err.message || err));
        console.log(err);
      });
    }
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log('  \u2717 ' + name);
    console.log('      ' + (err && err.message || err));
    console.log(err);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(msg || ('expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)));
}

async function group(name, fn) {
  console.log('[' + name + ']');
  await fn();
}

const helpers = { test, assert, eq, group };

const SUITES = [
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
  './suites/deep-freeze.test.cjs',
  './suites/schema-enforcement.test.cjs',
  './suites/snapshot-compression.test.cjs',
  './suites/determinism-contract.test.cjs',
  './suites/schema-migration.test.cjs',
  './suites/channel-split.test.cjs',
  './suites/replay-determinism.test.cjs',
  './suites/provider-gemini.test.cjs',
  './suites/redaction.test.cjs',
  './suites/model-client-construct.test.cjs',
  './suites/similarity.test.cjs',
  './suites/drift.test.cjs',
  './suites/drift_v02.test.cjs',
  './suites/stability.test.cjs',
  './suites/patterns.test.cjs',
  './suites/shadow-mode.test.cjs',
  './suites/classifier.test.cjs',
  './suites/stabilization-rotation.test.cjs',
  './suites/delta-report.test.cjs',
  './suites/phase-8.test.cjs',
  './suites/familiarity-trigger.test.cjs',
  './suites/navigator.test.cjs',
  './suites/presence.test.cjs',
  './suites/mcp-message-bus.test.cjs',
  './suites/mcp-notebook-bridge.test.cjs',
  './suites/mcp-notebook-client.test.cjs',
  './suites/mcp-config-and-docs.test.cjs',
  './suites/dashboard.test.cjs',
  './suites/scc.test.cjs'
];

(async () => {
  for (const suitePath of SUITES) {
    try {
      const suite = require(suitePath);
      await suite(helpers);
    } catch (e) {
      console.log('Error in suite: ' + suitePath);
      console.log(e);
      failed++;
    }
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log('  - ' + f.name + ': ' + (f.err && f.err.message || f.err));
    }
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('runner error:', e);
  process.exit(2);
});
